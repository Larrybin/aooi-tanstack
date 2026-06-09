import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();

function fail(message) {
  console.error(`tanstack native validation failed: ${message}`);
  process.exitCode = 1;
}

function walk(dir, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const entry of readdirSync(dir)) {
    if (
      ['node_modules', '.git', '.next', '.open-next', 'dist', 'out'].includes(
        entry
      )
    ) {
      continue;
    }
    const path = join(dir, entry);
    const stats = statSync(path);
    if (stats.isDirectory()) walk(path, acc);
    else if (/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(path)) acc.push(path);
  }
  return acc;
}

function contains(path, regex) {
  return regex.test(readFileSync(path, 'utf8'));
}

const requiredFiles = [
  'apps/web/src/routes/__root.tsx',
  'apps/web/src/routeTree.gen.ts',
  'apps/web/src/routes/$locale/pricing.tsx',
  'apps/web/src/routes/api/payment/checkout.ts',
  'apps/web/src/routes/api/payment/notify.ts',
  'apps/web/src/routes/api/user/get-user-credits.ts',
  'apps/web/src/server/api-context.ts',
  'src/shared/seo/canonical.ts',
  'src/shared/i18n/locale.ts',
  'src/domains/pricing/application/pricing-page.ts',
  'vite.config.mts',
  'tsconfig.tanstack.json',
];

for (const file of requiredFiles) {
  if (!existsSync(join(root, file))) {
    fail(`missing required file ${file}`);
  }
}

const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const scripts = pkg.scripts || {};
for (const scriptName of [
  'dev',
  'build',
  'check',
  'test',
  'cf:check',
  'cf:build',
  'cf:build:no-db',
  'contract:check',
]) {
  if (!scripts[scriptName]) fail(`missing legacy script ${scriptName}`);
}
for (const scriptName of [
  'tanstack:dev',
  'tanstack:build',
  'tanstack:typecheck',
  'tanstack:inventory',
  'tanstack:validate',
]) {
  if (!scripts[scriptName]) fail(`missing TanStack script ${scriptName}`);
}

if (/vite build/.test(scripts['cf:build'] || '')) {
  fail('cf:build must not be simplified to vite build');
}
if (/vite build/.test(scripts['cf:build:no-db'] || '')) {
  fail('cf:build:no-db must not be simplified to vite build');
}

const allDeps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
if (allDeps['@cloudflare/vite-plugin'] === '^2.2.0') {
  fail('@cloudflare/vite-plugin ^2.2.0 is not a valid baseline');
}

const strictDirs = [
  'apps/web',
  'src/shared/i18n',
  'src/shared/seo',
  'src/shared/brand',
  'src/domains/pricing',
];
const strictFiles = strictDirs.flatMap((dir) => walk(join(root, dir)));
const forbiddenPatterns = [
  [/from\s+['"]next\//, 'next/* import'],
  [/from\s+['"]next-intl/, 'next-intl import'],
  [/next-shims/, 'next-shims reference'],
  [/React\.use\(Promise\.resolve/, 'React.use(Promise.resolve(...))'],
  [/params\s*:\s*Promise/, 'params: Promise'],
  [/generateMetadata/, 'generateMetadata'],
  [/generateStaticParams/, 'generateStaticParams'],
  [/let\s+currentRequest/, 'global currentRequest'],
  [/let\s+pendingSetCookies/, 'global pendingSetCookies'],
  [/let\s+requestLocale/, 'global requestLocale'],
];

for (const file of strictFiles) {
  for (const [regex, label] of forbiddenPatterns) {
    if (contains(file, regex)) {
      fail(`${label} found in ${relative(root, file)}`);
    }
  }
}

const routeFiles = [
  'apps/web/src/routes/$locale/pricing.tsx',
  'apps/web/src/routes/api/payment/checkout.ts',
  'apps/web/src/routes/api/payment/notify.ts',
  'apps/web/src/routes/api/user/get-user-credits.ts',
];
for (const file of routeFiles) {
  const abs = join(root, file);
  if (!contains(abs, /createFileRoute/)) {
    fail(`${file} must use createFileRoute`);
  }
}

if (!process.exitCode) {
  console.log('tanstack native validation passed for Gate 0-3 baseline.');
}
