import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const args = new Set(process.argv.slice(2));
const reportMode = args.has('--report');
for (const arg of args) {
  if (arg !== '--report') throw new Error(`unknown argument: ${arg}`);
}

const IGNORED_DIRS = new Set(['.git', 'node_modules', 'dist', '.next', '.open-next', 'out']);
const SCAN_ROOTS = [
  'apps',
  'src',
  'cloudflare',
  'scripts',
  'package.json',
  'wrangler.cloudflare.toml',
];
const ROOT_DELETE_TARGETS = ['next.config.mjs', 'next-env.d.ts'];
const CHECKER_PATH = 'scripts/check-gate-5-6-no-next.mjs';
const PACKAGE_NAMES = new Set([
  'next',
  'next-intl',
  '@next/env',
  '@next/bundle-analyzer',
  '@opennextjs/cloudflare',
  'server-only',
  'nextjs-toploader',
  'eslint-config-next',
]);

function abs(repoPath) {
  return path.resolve(root, repoPath);
}

function toRepoPath(filePath) {
  return path.relative(root, filePath).split(path.sep).join('/');
}

function isTestFile(repoPath) {
  return /\.(test|spec)\.(mjs|[tj]sx?)$/.test(repoPath);
}

function isIgnored(repoPath) {
  if (repoPath === CHECKER_PATH) return true;
  if (repoPath.startsWith('docs/')) return true;
  if (isTestFile(repoPath)) return true;
  return repoPath.split('/').some((part) => IGNORED_DIRS.has(part));
}

function shouldScanFile(filePath) {
  const repoPath = toRepoPath(filePath);
  if (isIgnored(repoPath)) return false;
  return /\.(ts|tsx|mts|mjs|js|jsx|cjs|json|toml|d\.ts)$/.test(repoPath);
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
  if (isIgnored(repoPath)) return;
  for (const entry of readdirSync(currentPath, { withFileTypes: true })) {
    if (entry.isDirectory() && IGNORED_DIRS.has(entry.name)) continue;
    walk(path.join(currentPath, entry.name), out);
  }
}

function collectFiles() {
  const files = [];
  for (const scanRoot of SCAN_ROOTS) walk(abs(scanRoot), files);
  return files.sort((left, right) => toRepoPath(left).localeCompare(toRepoPath(right)));
}

function isForbiddenSpecifier(specifier) {
  return (
    specifier === 'next' ||
    specifier.startsWith('next/') ||
    specifier === 'next-intl' ||
    specifier.startsWith('next-intl/') ||
    specifier === '@next/env' ||
    specifier.startsWith('@opennextjs/') ||
    specifier === 'server-only' ||
    specifier === 'nextjs-toploader' ||
    specifier.startsWith('@/app/') ||
    specifier.startsWith('src/app/') ||
    specifier.includes('.open-next')
  );
}

function readImportSpecifiers(source) {
  const specifiers = [];
  const patterns = [
    /^\s*(?:import|export)\s+(?:type\s+)?[\s\S]*?\s+from\s+['"]([^'"]+)['"]/gm,
    /^\s*import\s+['"]([^'"]+)['"]/gm,
    /import\s*\(\s*['"]([^'"]+)['"]\s*\)/gm,
    /require\s*\(\s*['"]([^'"]+)['"]\s*\)/gm,
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      if (match[1]) specifiers.push(match[1]);
    }
  }
  return specifiers;
}

function classifyPackageJson(repoPath, source) {
  const hits = [];
  if (repoPath !== 'package.json') return hits;
  const pkg = JSON.parse(source);
  for (const section of ['dependencies', 'devDependencies', 'optionalDependencies']) {
    const deps = pkg[section] ?? {};
    for (const packageName of Object.keys(deps)) {
      if (PACKAGE_NAMES.has(packageName)) {
        hits.push({ repoPath, line: 1, token: packageName, classification: 'package_delete_target', reason: 'legacy Next/OpenNext package must be removed in Gate 5.6' });
      }
    }
  }
  for (const [name, command] of Object.entries(pkg.scripts ?? {})) {
    const commandText = String(command);
    if (commandText.includes('next ') || commandText.includes('next-build') || commandText.includes('src/app/')) {
      hits.push({ repoPath, line: 1, token: `script:${name}`, classification: 'active_blocker', reason: 'package script still invokes legacy Next path' });
    }
  }
  return hits;
}

function collectHits() {
  const hits = [];
  if (existsSync(abs('src/app'))) {
    hits.push({ repoPath: 'src/app', line: 1, token: 'src/app/**', classification: 'delete_target', reason: 'legacy Next app baseline must be deleted' });
  }
  for (const repoPath of ROOT_DELETE_TARGETS) {
    if (existsSync(abs(repoPath))) {
      hits.push({ repoPath, line: 1, token: repoPath, classification: 'config_delete_target', reason: 'Next root file must be deleted' });
    }
  }
  for (const filePath of collectFiles()) {
    const repoPath = toRepoPath(filePath);
    const source = readFileSync(filePath, 'utf8');
    hits.push(...classifyPackageJson(repoPath, source));
    if (repoPath === 'package.json') continue;
    for (const specifier of readImportSpecifiers(source)) {
      if (isForbiddenSpecifier(specifier)) {
        hits.push({ repoPath, line: 1, token: specifier, classification: 'active_blocker', reason: 'active source still imports Next/OpenNext/server-only residue' });
      }
    }
    source.split('\n').forEach((line, index) => {
      for (const token of [
        'NEXT_INC_CACHE_R2_BUCKET',
        'NEXT_CACHE_DO_QUEUE',
        'NEXT_TAG_CACHE_DO_SHARDED',
        'DOQueueHandler',
        'DOShardedTagCache',
        'opennext-cache',
      ]) {
        if (line.includes(token)) {
          hits.push({
            repoPath,
            line: index + 1,
            token,
            classification: 'active_blocker',
            reason: 'active Cloudflare config still exposes legacy Next/OpenNext cache residue',
          });
        }
      }
    });
  }
  return hits;
}

const hits = collectHits();
const groups = new Map();
for (const hit of hits) {
  const list = groups.get(hit.classification) ?? [];
  list.push(hit);
  groups.set(hit.classification, list);
}

console.log('Gate 5.6 no-Next report');
for (const classification of ['active_blocker', 'delete_target', 'package_delete_target', 'config_delete_target']) {
  console.log(`${classification}: ${(groups.get(classification) ?? []).length}`);
}

for (const [classification, list] of groups) {
  if (list.length === 0) continue;
  console.log(`\n[${classification}] ${list.length}`);
  const visible = reportMode ? list : list.slice(0, 30);
  for (const hit of visible) console.log(`- ${hit.repoPath}:${hit.line} ${hit.token} (${hit.reason})`);
  if (!reportMode && list.length > visible.length) console.log(`- ... ${list.length - visible.length} more`);
}

const failures = [];
for (const classification of ['active_blocker', 'delete_target', 'package_delete_target', 'config_delete_target']) {
  const count = (groups.get(classification) ?? []).length;
  if (!reportMode && count > 0) failures.push(`${classification} remain: ${count}`);
}

if (failures.length > 0) {
  console.error('\nGate 5.6 no-Next check failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(reportMode ? '\nGate 5.6 report completed.' : '\nGate 5.6 no-Next check passed.');
