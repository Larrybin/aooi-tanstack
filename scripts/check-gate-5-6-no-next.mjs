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
  'tests',
  'package.json',
  'pnpm-lock.yaml',
  'tsconfig.json',
  'tsconfig.tanstack.json',
  'vite.config.mts',
  'eslint.config.mjs',
  'dependency-cruiser.cjs',
  'architecture-rules.cjs',
  'next.config.mjs',
  'next-env.d.ts',
];
const CHECKER_PATH = 'scripts/check-gate-5-6-no-next.mjs';
const TRACKED = [
  '@/app/',
  'src/app/',
  'next/',
  'next-intl',
  '@next/env',
  '@next/bundle-analyzer',
  '@opennextjs/',
  'opennextjs-cloudflare',
  'server-only',
  'nextjs-toploader',
  'eslint-config-next',
  '.open-next',
  'next.config',
  'next-env.d.ts',
];
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

function isIgnored(repoPath) {
  if (repoPath === CHECKER_PATH) return true;
  if (repoPath.startsWith('docs/')) return true;
  return repoPath.split('/').some((part) => IGNORED_DIRS.has(part));
}

function shouldScanFile(filePath) {
  const repoPath = toRepoPath(filePath);
  if (isIgnored(repoPath)) return false;
  return /\.(ts|tsx|mts|mjs|js|jsx|cjs|json|toml|yaml|yml|d\.ts)$/.test(repoPath);
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

function classifyPackageJson(repoPath, source) {
  const hits = [];
  if (repoPath !== 'package.json') return hits;
  const pkg = JSON.parse(source);
  for (const section of ['dependencies', 'devDependencies', 'optionalDependencies']) {
    const deps = pkg[section] ?? {};
    for (const packageName of Object.keys(deps)) {
      if (PACKAGE_NAMES.has(packageName)) {
        hits.push({
          repoPath,
          line: 1,
          token: packageName,
          classification: 'package_delete_target',
          reason: 'legacy Next/OpenNext package must be removed in Gate 5.6',
        });
      }
    }
  }
  for (const [name, command] of Object.entries(pkg.scripts ?? {})) {
    if (String(command).includes('next ')) {
      hits.push({
        repoPath,
        line: 1,
        token: `script:${name}`,
        classification: 'active_blocker',
        reason: 'package script still invokes Next CLI',
      });
    }
  }
  return hits;
}

function classifyLine(repoPath, lineNumber, line) {
  const hits = [];
  if (repoPath === 'package.json') return hits;
  if (repoPath === 'pnpm-lock.yaml') {
    for (const token of TRACKED) {
      if (line.includes(token)) {
        hits.push({ repoPath, line: lineNumber, token, classification: 'package_delete_target', reason: 'lockfile residue is removed with package deletion' });
      }
    }
    return hits;
  }
  if (repoPath.startsWith('src/app/')) {
    hits.push({ repoPath, line: lineNumber, token: 'src/app/**', classification: 'delete_target', reason: 'legacy Next app baseline must be deleted' });
    return hits;
  }
  if (repoPath === 'next.config.mjs' || repoPath === 'next-env.d.ts') {
    hits.push({ repoPath, line: lineNumber, token: repoPath, classification: 'config_delete_target', reason: 'Next root file must be deleted' });
    return hits;
  }
  if (repoPath.includes('check-gate-') || repoPath.includes('tanstack-native-inventory') || repoPath.includes('validate-tanstack-native-migration') || repoPath.includes('tanstack-gate-4-plan')) {
    return hits;
  }
  for (const token of TRACKED) {
    if (!line.includes(token)) continue;
    if (token === 'src/app/' && repoPath.startsWith('docs/')) continue;
    hits.push({
      repoPath,
      line: lineNumber,
      token,
      classification: 'active_blocker',
      reason: 'active source/config still references Next/OpenNext/server-only residue',
    });
  }
  return hits;
}

function collectHits() {
  const hits = [];
  for (const filePath of collectFiles()) {
    const repoPath = toRepoPath(filePath);
    const source = readFileSync(filePath, 'utf8');
    hits.push(...classifyPackageJson(repoPath, source));
    const lines = source.split('\n');
    for (let index = 0; index < lines.length; index += 1) {
      hits.push(...classifyLine(repoPath, index + 1, lines[index]));
    }
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
  for (const hit of visible) {
    console.log(`- ${hit.repoPath}:${hit.line} ${hit.token} (${hit.reason})`);
  }
  if (!reportMode && list.length > visible.length) {
    console.log(`- ... ${list.length - visible.length} more`);
  }
}

const failures = [];
const activeBlockers = groups.get('active_blocker') ?? [];
const deleteTargets = groups.get('delete_target') ?? [];
const packageTargets = groups.get('package_delete_target') ?? [];
const configTargets = groups.get('config_delete_target') ?? [];
if (!reportMode && activeBlockers.length > 0) failures.push(`active blockers remain: ${activeBlockers.length}`);
if (!reportMode && deleteTargets.length > 0) failures.push(`legacy delete targets remain: ${deleteTargets.length}`);
if (!reportMode && packageTargets.length > 0) failures.push(`package delete targets remain: ${packageTargets.length}`);
if (!reportMode && configTargets.length > 0) failures.push(`config delete targets remain: ${configTargets.length}`);

if (failures.length > 0) {
  console.error('\nGate 5.6 no-Next check failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(reportMode ? '\nGate 5.6 report completed.' : '\nGate 5.6 no-Next check passed.');
