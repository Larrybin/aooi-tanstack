import { existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const args = new Set(process.argv.slice(2));
const reportMode = args.has('--report');
for (const arg of args) if (arg !== '--report') throw new Error(`unknown argument: ${arg}`);

const REQUIRED_ROUTE_FILES = [
  'apps/web/src/routes/index.tsx',
  'apps/web/src/routes/$locale/$slug.tsx',
  'apps/web/src/routes/$slug.tsx',
  'apps/web/src/routes/$locale/pricing.tsx',
  'apps/web/src/routes/api/payment/checkout.ts',
  'apps/web/src/routes/api/payment/notify.ts',
  'apps/web/src/routes/api/payment/callback.ts',
  'apps/web/src/routes/api/auth/$.ts',
  'apps/web/src/routes/api/user/get-user-credits.ts',
  'apps/web/src/routes/api/storage/upload-image.ts',
];

function abs(repoPath) { return path.resolve(root, repoPath); }
function walk(dir, out) {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(full);
  }
}
function countFiles(repoPath) {
  const out = [];
  walk(abs(repoPath), out);
  return out.length;
}

const missing = REQUIRED_ROUTE_FILES.filter((repoPath) => !existsSync(abs(repoPath)));
const legacyAppFileCount = existsSync(abs('src/app')) && statSync(abs('src/app')).isDirectory() ? countFiles('src/app') : 0;
const tanstackRouteCount = countFiles('apps/web/src/routes');

console.log('Gate 5.6 route coverage report');
console.log(`required TanStack route files: ${REQUIRED_ROUTE_FILES.length}`);
console.log(`missing required TanStack route files: ${missing.length}`);
console.log(`TanStack route file count: ${tanstackRouteCount}`);
console.log(`legacy src/app file count: ${legacyAppFileCount}`);
if (missing.length > 0) {
  console.log('\n[missing required routes]');
  for (const repoPath of missing) console.log(`- ${repoPath}`);
}

const failures = [];
if (missing.length > 0) failures.push(`missing required TanStack route files: ${missing.length}`);
if (tanstackRouteCount === 0) failures.push('TanStack route tree is empty');

if (failures.length > 0) {
  console.error('\nGate 5.6 route coverage check failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(reportMode ? '\nGate 5.6 route coverage report completed.' : '\nGate 5.6 route coverage check passed.');
