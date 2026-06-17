import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
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
  'apps/web/src/routes/admin_.tsx',
  'apps/web/src/routes/$locale/admin_.tsx',
  'apps/web/src/routes/admin/$.tsx',
  'apps/web/src/routes/$locale/admin/$.tsx',
  'apps/web/src/routes/chat/$.tsx',
  'apps/web/src/routes/$locale/chat/$.tsx',
  'apps/web/src/routes/docs_.tsx',
  'apps/web/src/routes/docs/$.tsx',
  'apps/web/src/routes/$locale/docs_.tsx',
  'apps/web/src/routes/$locale/docs/$.tsx',
  'apps/web/src/routes/chat_.tsx',
  'apps/web/src/routes/$locale/chat_.tsx',
  'apps/web/src/routes/my-images.tsx',
  'apps/web/src/routes/$locale/my-images.tsx',
  'apps/web/src/routes/robots[.]txt.ts',
  'apps/web/src/routes/sitemap[.]xml.ts',
  'apps/web/src/routes/ads[.]txt.ts',
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

function readRepoFile(repoPath) {
  return existsSync(abs(repoPath)) ? readFileSync(abs(repoPath), 'utf8') : '';
}

const missing = REQUIRED_ROUTE_FILES.filter((repoPath) => !existsSync(abs(repoPath)));
const paymentCallbackSource = readRepoFile('apps/web/src/routes/api/payment/callback.ts');
const routerMiddlewareSource = readRepoFile('cloudflare/workers/router-middleware.ts');

const routeSources = {
  adminRoot: readRepoFile('apps/web/src/routes/admin_.tsx'),
  adminSplat: readRepoFile('apps/web/src/routes/admin/$.tsx'),
  chatRoot: readRepoFile('apps/web/src/routes/chat_.tsx'),
  chatSplat: readRepoFile('apps/web/src/routes/chat/$.tsx'),
  docsRoot: readRepoFile('apps/web/src/routes/docs_.tsx'),
  docsSplat: readRepoFile('apps/web/src/routes/docs/$.tsx'),
  myImagesRoot: readRepoFile('apps/web/src/routes/my-images.tsx'),
};
const contractFailures = [];
if (!/GET\s*:/.test(paymentCallbackSource)) {
  contractFailures.push('api payment callback route must expose GET');
}
if (/docs\/index/.test(routerMiddlewareSource)) {
  contractFailures.push('router middleware must not rewrite /docs to missing docs/index route');
}

if (/href:\s*['"]\/no-permission/.test(routeSources.adminRoot) || /href:\s*['"]\/no-permission/.test(routeSources.adminSplat)) {
  contractFailures.push('admin routes must not hard-redirect all admin traffic to no-permission');
}
if (/activity\/chats/.test(routeSources.chatRoot) || /activity\/chats/.test(routeSources.chatSplat)) {
  contractFailures.push('chat routes must restore chat pages instead of redirecting to activity/chats');
}
if (/activity\/ai-tasks/.test(routeSources.myImagesRoot) && /redirect/.test(routeSources.myImagesRoot)) {
  contractFailures.push('my-images route must render saved jobs instead of redirecting to activity/ai-tasks');
}
if (!/loadDocsRouteData/.test(routeSources.docsRoot) || !/loadDocsRouteData/.test(routeSources.docsSplat)) {
  contractFailures.push('docs routes must load docs content, including docs splat routes');
}
const legacyAppFileCount = existsSync(abs('src/app')) && statSync(abs('src/app')).isDirectory() ? countFiles('src/app') : 0;
const tanstackRouteCount = countFiles('apps/web/src/routes');

console.log('Gate 5.6 route coverage report');
console.log(`required TanStack route files: ${REQUIRED_ROUTE_FILES.length}`);
console.log(`missing required TanStack route files: ${missing.length}`);
console.log(`TanStack route file count: ${tanstackRouteCount}`);
console.log(`legacy src/app file count: ${legacyAppFileCount}`);
console.log(`route contract failures: ${contractFailures.length}`);
if (missing.length > 0) {
  console.log('\n[missing required routes]');
  for (const repoPath of missing) console.log(`- ${repoPath}`);
}

const failures = [];
if (missing.length > 0) failures.push(`missing required TanStack route files: ${missing.length}`);
if (contractFailures.length > 0) failures.push(`route contract failures: ${contractFailures.join(', ')}`);
if (tanstackRouteCount === 0) failures.push('TanStack route tree is empty');

if (failures.length > 0) {
  console.error('\nGate 5.6 route coverage check failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(reportMode ? '\nGate 5.6 route coverage report completed.' : '\nGate 5.6 route coverage check passed.');
