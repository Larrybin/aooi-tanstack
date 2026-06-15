
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

import { protectedServerOnlyFiles } from './gate-5-4-server-only-protected-files.mjs';

const root = process.cwd();
const marker = 'server-only';
const TEST_FILE_PATTERN = /\.(test|spec)\.(mjs|[tj]sx?)$/;
const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.mts', '.mjs', '.js', '.jsx', '.cjs'];
const INDEX_EXTENSIONS = SOURCE_EXTENSIONS.map((extension) => `/index${extension}`);
const IGNORED_DIRS = new Set(['.git', '.next', '.open-next', 'dist', 'node_modules', 'out']);
const SCAN_ROOTS = ['apps', 'src', 'scripts', 'cloudflare', 'vite.config.mts', 'package.json'];
const CHECKER_FILES = new Set([
  'scripts/check-gate-5-4-server-only-markers.mjs',
  'scripts/gate-5-4-server-only-protected-files.mjs',
]);
const args = new Set(process.argv.slice(2));
const reportMode = args.has('--report');

for (const arg of args) {
  if (arg !== '--report') throw new Error(`unknown argument: ${arg}`);
}

function toRepoPath(filePath) {
  return path.relative(root, filePath).split(path.sep).join('/');
}

function abs(repoPath) {
  return path.resolve(root, repoPath);
}

function isIgnoredRepoPath(repoPath) {
  if (CHECKER_FILES.has(repoPath)) return true;
  if (repoPath.startsWith('src/app/')) return true;
  if (repoPath.startsWith('docs/')) return true;
  if (TEST_FILE_PATTERN.test(repoPath)) return true;
  return repoPath.split('/').some((part) => IGNORED_DIRS.has(part));
}

function shouldScanFile(filePath) {
  const repoPath = toRepoPath(filePath);
  if (isIgnoredRepoPath(repoPath)) return false;
  if (repoPath === 'package.json' || repoPath === 'vite.config.mts') return true;
  return SOURCE_EXTENSIONS.some((extension) => repoPath.endsWith(extension));
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
  const out = [];
  for (const scanRoot of SCAN_ROOTS) walk(abs(scanRoot), out);
  return out.sort((left, right) => toRepoPath(left).localeCompare(toRepoPath(right)));
}

function collectSourceMarkerHits(files) {
  const protectedSet = new Set(protectedServerOnlyFiles);
  const hits = [];
  const unexpected = [];
  for (const filePath of files) {
    const repoPath = toRepoPath(filePath);
    if (repoPath === 'package.json' || repoPath === 'vite.config.mts') continue;
    const lines = readFileSync(filePath, 'utf8').split('\n');
    for (let index = 0; index < lines.length; index += 1) {
      const trimmed = lines[index].trim();
      if (trimmed !== `import '${marker}';` && trimmed !== `import "${marker}";`) continue;
      const hit = { repoPath, line: index + 1 };
      hits.push(hit);
      if (!protectedSet.has(repoPath)) unexpected.push(hit);
    }
  }
  return { hits, unexpected };
}

function isClientFile(source) {
  const lines = source.split('\n').slice(0, 8).map((line) => line.trim());
  return lines.some((line) => line === "'use client';" || line === '"use client";' || line === "'use client'" || line === '"use client"');
}

function isEntryRoot(repoPath, source) {
  if (isClientFile(source)) return true;
  if (repoPath.startsWith('apps/web/src/routes/') && !repoPath.startsWith('apps/web/src/routes/api/')) return true;
  if (repoPath.startsWith('src/surfaces/') && /\.(view|shell)\.(ts|tsx)$/.test(repoPath)) return true;
  if (repoPath.startsWith('src/shared/blocks/')) return true;
  if (repoPath.startsWith('src/shared/components/')) return true;
  if (/^src\/domains\/[^/]+\/ui\//.test(repoPath)) return true;
  return false;
}

function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

function extractValueImportSpecifiers(source) {
  const cleaned = stripComments(source);
  const imports = [];
  const patterns = [
    /\bimport\s+(?!type\b)(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/g,
    /\bexport\s+(?!type\b)[\s\S]*?\s+from\s+['"]([^'"]+)['"]/g,
    /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g,
    /\brequire\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(cleaned)) !== null) imports.push(match[1]);
  }
  return imports;
}

function resolveCandidate(candidate) {
  if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  for (const extension of SOURCE_EXTENSIONS) {
    if (existsSync(`${candidate}${extension}`)) return `${candidate}${extension}`;
  }
  if (existsSync(candidate) && statSync(candidate).isDirectory()) {
    for (const indexExtension of INDEX_EXTENSIONS) {
      const indexFile = `${candidate}${indexExtension}`;
      if (existsSync(indexFile)) return indexFile;
    }
  }
  return null;
}

function resolveSpecifier(fromRepoPath, specifier) {
  if (specifier.startsWith('@/')) return resolveCandidate(abs(`src/${specifier.slice(2)}`));
  if (specifier.startsWith('.')) return resolveCandidate(path.resolve(path.dirname(abs(fromRepoPath)), specifier));
  return null;
}

function buildGraph(files) {
  const fileSet = new Set(files.map(toRepoPath));
  const sources = new Map();
  const graph = new Map();
  const entryRoots = [];
  for (const filePath of files) {
    const repoPath = toRepoPath(filePath);
    if (!SOURCE_EXTENSIONS.some((extension) => repoPath.endsWith(extension))) continue;
    const source = readFileSync(filePath, 'utf8');
    sources.set(repoPath, source);
    if (isEntryRoot(repoPath, source)) entryRoots.push(repoPath);
  }
  for (const [repoPath, source] of sources) {
    const resolved = [];
    for (const specifier of extractValueImportSpecifiers(source)) {
      const resolvedPath = resolveSpecifier(repoPath, specifier);
      if (!resolvedPath) continue;
      const resolvedRepoPath = toRepoPath(resolvedPath);
      if (resolvedRepoPath.startsWith('src/server/')) continue;
      if (/\.data\.(ts|tsx)$/.test(resolvedRepoPath)) continue;
      if (fileSet.has(resolvedRepoPath) && !isIgnoredRepoPath(resolvedRepoPath)) resolved.push(resolvedRepoPath);
    }
    graph.set(repoPath, resolved);
  }
  return { graph, entryRoots };
}

function findReachabilityViolations(files) {
  const { graph, entryRoots } = buildGraph(files);
  const protectedSet = new Set(protectedServerOnlyFiles);
  const violations = [];
  for (const entry of entryRoots) {
    const queue = [{ repoPath: entry, path: [entry] }];
    const seen = new Set([entry]);
    while (queue.length > 0) {
      const current = queue.shift();
      if (current.repoPath !== entry && protectedSet.has(current.repoPath)) {
        violations.push({ entry, target: current.repoPath, path: current.path });
        continue;
      }
      for (const next of graph.get(current.repoPath) ?? []) {
        if (seen.has(next)) continue;
        seen.add(next);
        queue.push({ repoPath: next, path: [...current.path, next] });
      }
    }
  }
  return violations;
}

function assertProtectedManifest() {
  const unique = new Set(protectedServerOnlyFiles);
  const missing = protectedServerOnlyFiles.filter((repoPath) => !existsSync(abs(repoPath)));
  const duplicates = protectedServerOnlyFiles.filter((repoPath, index) => protectedServerOnlyFiles.indexOf(repoPath) !== index);
  return { uniqueCount: unique.size, missing, duplicates };
}

const files = collectFiles();
const markerResult = collectSourceMarkerHits(files);
const manifestResult = assertProtectedManifest();
const reachabilityViolations = findReachabilityViolations(files);

console.log('Gate 5.4 server-only marker report');
console.log(`protected module count: ${manifestResult.uniqueCount}`);
console.log(`source marker count: ${markerResult.hits.length}`);
console.log(`reachability violation count: ${reachabilityViolations.length}`);

if (reportMode && markerResult.hits.length > 0) {
  console.log('\n[source markers]');
  for (const hit of markerResult.hits) console.log(`- ${hit.repoPath}:${hit.line}`);
}
if (reachabilityViolations.length > 0) {
  console.log('\n[reachability violations]');
  for (const violation of reachabilityViolations) {
    console.log(`- ${violation.entry} -> ${violation.target}`);
    console.log(`  path: ${violation.path.join(' -> ')}`);
  }
}

const failures = [];
if (manifestResult.uniqueCount !== protectedServerOnlyFiles.length) failures.push('protected manifest contains duplicate paths');
if (manifestResult.missing.length > 0) failures.push(`protected files missing: ${manifestResult.missing.join(', ')}`);
if (manifestResult.duplicates.length > 0) failures.push(`protected duplicate files: ${manifestResult.duplicates.join(', ')}`);
if (markerResult.unexpected.length > 0) failures.push(`unexpected marker files: ${markerResult.unexpected.map((hit) => hit.repoPath).join(', ')}`);
if (reachabilityViolations.length > 0) failures.push(`protected reachability violations: ${reachabilityViolations.length}`);
if (!reportMode && markerResult.hits.length > 0) failures.push(`source server-only marker imports remain: ${markerResult.hits.length}`);

if (failures.length > 0) {
  console.error('\nGate 5.4 server-only marker check failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(reportMode ? '\nGate 5.4 report completed.' : '\nGate 5.4 server-only marker check passed.');
