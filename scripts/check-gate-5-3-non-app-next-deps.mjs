import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const root = process.cwd();
const TEST_FILE_PATTERN = /\.(test|spec)\.(mjs|[tj]sx?)$/;
const IGNORED_DIRS = new Set([
  '.git',
  '.next',
  '.open-next',
  'dist',
  'node_modules',
  'out',
]);
const SCAN_ROOTS = [
  'apps',
  'src',
  'scripts',
  'cloudflare',
  'package.json',
  'vite.config.mts',
];
const CHECKER_PATH = 'scripts/check-gate-5-3-non-app-next-deps.mjs';
const VALID_CLASSIFICATIONS = new Set([
  'migrated',
  'active_blocker',
  'legacy_only',
  'defer_gate_5_4_server_only',
  'defer_gate_5_5_opennext_worker',
  'defer_gate_5_6_next_cache',
  'defer_gate_5_6_next_deletion',
]);

const args = new Set(process.argv.slice(2));
const reportMode = args.has('--report');
for (const arg of args) {
  if (arg !== '--report') {
    throw new Error(`unknown argument: ${arg}`);
  }
}

function toRepoPath(filePath) {
  return path.relative(root, filePath).split(path.sep).join('/');
}

function isIgnoredRepoPath(repoPath) {
  if (repoPath === CHECKER_PATH) return true;
  if (repoPath.startsWith('src/app/')) return true;
  if (repoPath.startsWith('docs/')) return true;
  if (TEST_FILE_PATTERN.test(repoPath)) return true;
  return repoPath.split('/').some((part) => IGNORED_DIRS.has(part));
}

function shouldScanFile(filePath) {
  const repoPath = toRepoPath(filePath);
  if (isIgnoredRepoPath(repoPath)) return false;
  const basename = path.basename(repoPath);
  if (basename === 'package.json') return true;
  if (basename === 'vite.config.mts') return true;
  return /\.(ts|tsx|mts|mjs|js|jsx|cjs|json|toml|d\.ts)$/.test(repoPath);
}

function isCodeFile(repoPath) {
  return /\.(?:[cm]?[tj]sx?|d\.ts)$/.test(repoPath);
}

function walk(currentPath, out) {
  if (!existsSync(currentPath)) return;
  const stats = statSync(currentPath);
  if (stats.isFile()) {
    if (shouldScanFile(currentPath)) out.push(currentPath);
    return;
  }
  if (!stats.isDirectory()) return;
  const repoPath = toRepoPath(currentPath);
  if (isIgnoredRepoPath(repoPath)) return;
  for (const entry of readdirSync(currentPath, { withFileTypes: true })) {
    if (entry.isDirectory() && IGNORED_DIRS.has(entry.name)) continue;
    walk(path.join(currentPath, entry.name), out);
  }
}

function collectFiles() {
  const files = [];
  for (const scanRoot of SCAN_ROOTS) {
    walk(path.resolve(root, scanRoot), files);
  }
  return files.sort((left, right) =>
    toRepoPath(left).localeCompare(toRepoPath(right))
  );
}

function detectSpecifiers(repoPath, source) {
  const hits = [];
  const seen = new Set();
  const addHit = ({ line, specifier, kind }) => {
    if (!isTrackedDependency(specifier)) return;
    const key = `${line}:${specifier}:${kind}`;
    if (seen.has(key)) return;
    seen.add(key);
    hits.push({ line, specifier, kind });
  };

  if (repoPath === 'package.json') {
    const pkg = JSON.parse(source);
    for (const section of [
      'dependencies',
      'devDependencies',
      'optionalDependencies',
    ]) {
      const deps = pkg[section] ?? {};
      for (const depName of Object.keys(deps)) {
        if (isTrackedDependency(depName)) {
          addHit({ line: 1, specifier: depName, kind: `package:${section}` });
        }
      }
    }
    return hits;
  }

  if (isCodeFile(repoPath)) {
    const sourceFile = ts.createSourceFile(
      repoPath,
      source,
      ts.ScriptTarget.Latest,
      true,
      repoPath.endsWith('.tsx') || repoPath.endsWith('.jsx')
        ? ts.ScriptKind.TSX
        : ts.ScriptKind.TS
    );
    const lineOf = (node) =>
      sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line +
      1;
    const addModuleSpecifier = (moduleSpecifier, kind) => {
      if (!moduleSpecifier || !ts.isStringLiteralLike(moduleSpecifier)) return;
      addHit({
        line: lineOf(moduleSpecifier),
        specifier: moduleSpecifier.text,
        kind,
      });
    };

    const visit = (node) => {
      if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
        addModuleSpecifier(node.moduleSpecifier, 'import');
      } else if (ts.isCallExpression(node)) {
        const [firstArg] = node.arguments;
        if (
          firstArg &&
          ts.isStringLiteralLike(firstArg) &&
          (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
            (ts.isIdentifier(node.expression) &&
              node.expression.text === 'require'))
        ) {
          addHit({
            line: lineOf(firstArg),
            specifier: firstArg.text,
            kind: 'import',
          });
        }
      } else if (ts.isModuleDeclaration(node)) {
        if (ts.isStringLiteralLike(node.name)) {
          addHit({
            line: lineOf(node.name),
            specifier: node.name.text,
            kind: 'import',
          });
        }
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
  }

  const lines = source.split('\n');
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const lineNumber = index + 1;
    if (
      line.includes('.open-next') &&
      !hits.some(
        (hit) => hit.line === lineNumber && hit.specifier.includes('.open-next')
      )
    ) {
      addHit({
        line: lineNumber,
        specifier: '.open-next',
        kind: 'open-next-reference',
      });
    }
  }

  return hits;
}

function isTrackedDependency(specifier) {
  return (
    specifier === '@next/env' ||
    specifier.startsWith('@opennextjs/') ||
    specifier === 'next' ||
    specifier.startsWith('next/') ||
    specifier === 'next-intl' ||
    specifier.startsWith('next-intl/') ||
    specifier === 'nextjs-toploader' ||
    specifier === 'server-only' ||
    specifier.includes('.open-next')
  );
}

function reasonFor(classification, reason) {
  return { classification, reason };
}

function classifyHit(hit) {
  const { repoPath, specifier, kind } = hit;

  if (specifier === '@next/env') {
    if (kind.startsWith('package:')) {
      return reasonFor(
        'defer_gate_5_6_next_deletion',
        'package dependency removed only in Gate 5.6'
      );
    }
    if (
      repoPath === 'src/config/load-dotenv.ts' ||
      repoPath === 'src/infra/adapters/db/config.ts' ||
      repoPath === 'scripts/run-with-site.mjs'
    ) {
      return reasonFor(
        'active_blocker',
        'direct @next/env usage must be replaced in Gate 5.3-B'
      );
    }
    return reasonFor(
      'active_blocker',
      'unapproved direct @next/env usage outside src/app'
    );
  }

  if (specifier === 'server-only') {
    return reasonFor(
      'defer_gate_5_4_server_only',
      'server-only marker removal belongs to Gate 5.4'
    );
  }

  if (specifier === 'next/cache') {
    return reasonFor(
      'defer_gate_5_6_next_cache',
      'next/cache residue is preserved until approved cache/deletion gate'
    );
  }

  if (
    specifier.startsWith('@opennextjs/') ||
    specifier.includes('.open-next') ||
    repoPath.startsWith('cloudflare/') ||
    repoPath.startsWith('src/shared/types/open-next') ||
    repoPath.startsWith('src/shared/config/cloudflare-worker-topology') ||
    repoPath.startsWith('scripts/lib/cloudflare-build-artifacts') ||
    repoPath.startsWith('scripts/bundle-cf-server-functions') ||
    repoPath.startsWith('scripts/run-cf-multi-build-check')
  ) {
    return reasonFor(
      'defer_gate_5_5_opennext_worker',
      'OpenNext and split worker topology belong to Gate 5.5'
    );
  }

  if (kind.startsWith('package:')) {
    return reasonFor(
      'defer_gate_5_6_next_deletion',
      'package dependency removed only in Gate 5.6'
    );
  }

  if (repoPath === 'vite.config.mts') {
    return reasonFor(
      'defer_gate_5_4_server_only',
      'server-only alias is removed with Gate 5.4 server-only cleanup'
    );
  }

  if (repoPath === 'src/middleware.ts' || repoPath === 'src/request-proxy.ts') {
    return reasonFor(
      'legacy_only',
      'Next middleware/request proxy baseline is kept until src/app deletion gate'
    );
  }

  if (
    repoPath.startsWith('src/infra/platform/i18n/') ||
    repoPath.startsWith('src/infra/platform/auth/') ||
    repoPath.startsWith('src/shared/lib/action/') ||
    repoPath.startsWith('src/shared/lib/i18n/') ||
    repoPath.startsWith('src/domains/settings/')
  ) {
    return reasonFor(
      'legacy_only',
      'legacy platform/domain surface not in TanStack route closure'
    );
  }

  if (
    repoPath.startsWith('src/themes/default/') ||
    repoPath.startsWith('src/domains/chat/ui/') ||
    repoPath.startsWith('src/domains/account/ui/auth/') ||
    repoPath.startsWith('src/domains/ai/ui/')
  ) {
    return reasonFor(
      'legacy_only',
      'UI/provider component residue is classified; active TanStack reachability is checked by migration validator'
    );
  }

  if (
    repoPath.startsWith('src/shared/blocks/') ||
    repoPath.startsWith('src/shared/components/') ||
    repoPath.startsWith('src/extensions/')
  ) {
    return reasonFor(
      'defer_gate_5_6_next_deletion',
      'non-app Next residue requires explicit owner gate before deletion'
    );
  }

  if (
    specifier.startsWith('next/') ||
    specifier.startsWith('next-intl') ||
    specifier === 'nextjs-toploader'
  ) {
    return reasonFor(
      'defer_gate_5_6_next_deletion',
      'non-app Next residue requires explicit owner gate before deletion'
    );
  }

  return reasonFor('unclassified', 'no Gate 5.3 classification rule matched');
}

function collectHits() {
  const hits = [];
  for (const filePath of collectFiles()) {
    const repoPath = toRepoPath(filePath);
    const source = readFileSync(filePath, 'utf8');
    for (const hit of detectSpecifiers(repoPath, source)) {
      const classified = classifyHit({ ...hit, repoPath });
      hits.push({ repoPath, ...hit, ...classified });
    }
  }
  return hits;
}

function groupByClassification(hits) {
  const groups = new Map();
  for (const hit of hits) {
    if (!groups.has(hit.classification)) groups.set(hit.classification, []);
    groups.get(hit.classification).push(hit);
  }
  return groups;
}

function printReport(hits) {
  const groups = groupByClassification(hits);
  const order = [
    'active_blocker',
    'unclassified',
    'legacy_only',
    'defer_gate_5_4_server_only',
    'defer_gate_5_5_opennext_worker',
    'defer_gate_5_6_next_cache',
    'defer_gate_5_6_next_deletion',
    'migrated',
  ];
  console.log(`Gate 5.3 non-app Next dependency report: ${hits.length} hit(s)`);
  for (const classification of order) {
    const items = groups.get(classification) ?? [];
    if (items.length === 0) continue;
    console.log(`\n[${classification}] ${items.length}`);
    for (const item of items) {
      console.log(
        `- ${item.repoPath}:${item.line} ${item.specifier} (${item.reason})`
      );
    }
  }
}

const hits = collectHits();
const invalid = hits.filter(
  (hit) => !VALID_CLASSIFICATIONS.has(hit.classification)
);
const unclassified = hits.filter(
  (hit) => hit.classification === 'unclassified'
);
const activeBlockers = hits.filter(
  (hit) => hit.classification === 'active_blocker'
);

printReport(hits);

if (invalid.length > 0) {
  console.error(`\nInvalid classification(s): ${invalid.length}`);
  process.exit(1);
}

if (unclassified.length > 0) {
  console.error(
    `\nUnclassified non-app Next dependency hit(s): ${unclassified.length}`
  );
  process.exit(1);
}

if (!reportMode && activeBlockers.length > 0) {
  console.error(`\nActive blocker hit(s): ${activeBlockers.length}`);
  process.exit(1);
}

console.log(
  reportMode
    ? '\nGate 5.3 report completed.'
    : '\nGate 5.3 non-app Next dependency check passed.'
);
