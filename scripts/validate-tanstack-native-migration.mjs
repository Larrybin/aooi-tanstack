import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';

const root = process.cwd();
const legacyAppRetired = !existsSync(join(root, 'src/app'));

function fail(message) {
  if (
    legacyAppRetired &&
    (message.includes('must remain until') ||
      message.includes('Gate 4 generated page migration matrix is stale'))
  ) {
    return;
  }
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

function normalizePath(path) {
  return path.split('\\').join('/');
}

function stripSourceExtension(path) {
  return path.replace(/\.(ts|tsx|js|jsx|mjs|cjs)$/, '');
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function sourceFilesIn(dir) {
  return walk(join(root, dir)).filter((file) =>
    /\.(ts|tsx|js|jsx|mjs|cjs)$/.test(file)
  );
}

function resolveSourceFile(basePath) {
  const candidates = [
    basePath,
    `${basePath}.ts`,
    `${basePath}.tsx`,
    `${basePath}.js`,
    `${basePath}.jsx`,
    `${basePath}.mjs`,
    `${basePath}.cjs`,
    join(basePath, 'index.ts'),
    join(basePath, 'index.tsx'),
    join(basePath, 'index.js'),
    join(basePath, 'index.jsx'),
    join(basePath, 'index.mjs'),
    join(basePath, 'index.cjs'),
  ];

  return (
    candidates.find(
      (candidate) => existsSync(candidate) && statSync(candidate).isFile()
    ) ?? null
  );
}

function resolveLocalImport(fromFile, rawSpecifier) {
  const specifier = rawSpecifier.split('?')[0];
  if (specifier.startsWith('@/')) {
    return resolveSourceFile(join(root, 'src', specifier.slice(2)));
  }

  if (specifier.startsWith('.')) {
    return resolveSourceFile(join(dirname(fromFile), specifier));
  }

  return null;
}

function extractRuntimeImportSpecifiers(
  source,
  { includeDynamicImports = true } = {}
) {
  const specifiers = [];
  const fromImportRegex =
    /^\s*(?:import|export)\s+(type\s+)?[\s\S]*?\s+from\s+['"]([^'"]+)['"]/gm;
  const sideEffectImportRegex = /^\s*import\s+['"]([^'"]+)['"]/gm;
  const dynamicImportRegex = /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g;
  let match;

  while ((match = fromImportRegex.exec(source))) {
    if (!match[1]) {
      specifiers.push(match[2]);
    }
  }

  while ((match = sideEffectImportRegex.exec(source))) {
    specifiers.push(match[1]);
  }

  if (includeDynamicImports) {
    while ((match = dynamicImportRegex.exec(source))) {
      specifiers.push(match[1]);
    }
  }

  return specifiers;
}

function localRuntimeClosure(entryFiles, options = {}) {
  const visited = new Set();
  const stack = [...entryFiles];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || visited.has(current)) continue;
    visited.add(current);

    const source = readFileSync(current, 'utf8');
    for (const specifier of extractRuntimeImportSpecifiers(source, options)) {
      const resolved = resolveLocalImport(current, specifier);
      if (resolved && !visited.has(resolved)) {
        stack.push(resolved);
      }
    }
  }

  return [...visited].sort();
}

function importPathToRoutePath(routeImport) {
  const routePath = routeImport
    .replace(/^\.\/routes\//, '')
    .replace(/\/index$/, '')
    .replace(/^index$/, '')
    .replace(/\[\.\]/g, '.');

  return routePath ? `/${routePath}` : '/';
}

function routePathToFullPath(routePath) {
  return routePath.replace(/(^|\/)_/g, '$1').replace(/_($|\/)/g, '$1');
}

const requiredFiles = [
  'apps/web/src/routes/__root.tsx',
  'apps/web/src/routeTree.gen.ts',
  'apps/web/src/routes/index.tsx',
  'apps/web/src/routes/pricing.tsx',
  'apps/web/src/routes/$locale/pricing.tsx',
  'apps/web/src/routes/$locale/$slug.tsx',
  'apps/web/src/routes/blog_.tsx',
  'apps/web/src/routes/blog/$slug.tsx',
  'apps/web/src/routes/blog/category/$slug.tsx',
  'apps/web/src/routes/$locale/blog_.tsx',
  'apps/web/src/routes/settings_.tsx',
  'apps/web/src/routes/settings/profile.tsx',
  'apps/web/src/routes/settings/security.tsx',
  'apps/web/src/routes/settings/credits.tsx',
  'apps/web/src/routes/settings/billing.tsx',
  'apps/web/src/routes/settings/billing_/cancel.tsx',
  'apps/web/src/routes/settings/billing_/retrieve.tsx',
  'apps/web/src/routes/settings/invoices/retrieve.tsx',
  'apps/web/src/routes/settings/payments.tsx',
  'apps/web/src/routes/settings/apikeys.tsx',
  'apps/web/src/routes/settings/apikeys_/create.tsx',
  'apps/web/src/routes/settings/apikeys_/$id/edit.tsx',
  'apps/web/src/routes/settings/apikeys_/$id/delete.tsx',
  'apps/web/src/routes/activity_.tsx',
  'apps/web/src/routes/activity/ai-tasks.tsx',
  'apps/web/src/routes/activity/ai-tasks_/$id/refresh.tsx',
  'apps/web/src/routes/activity/chats.tsx',
  'apps/web/src/routes/activity/feedbacks.tsx',
  'apps/web/src/routes/$locale/settings_.tsx',
  'apps/web/src/routes/$locale/settings/profile.tsx',
  'apps/web/src/routes/$locale/settings/security.tsx',
  'apps/web/src/routes/$locale/settings/credits.tsx',
  'apps/web/src/routes/$locale/settings/billing.tsx',
  'apps/web/src/routes/$locale/settings/billing_/cancel.tsx',
  'apps/web/src/routes/$locale/settings/billing_/retrieve.tsx',
  'apps/web/src/routes/$locale/settings/invoices/retrieve.tsx',
  'apps/web/src/routes/$locale/settings/payments.tsx',
  'apps/web/src/routes/$locale/settings/apikeys.tsx',
  'apps/web/src/routes/$locale/settings/apikeys_/create.tsx',
  'apps/web/src/routes/$locale/settings/apikeys_/$id/edit.tsx',
  'apps/web/src/routes/$locale/settings/apikeys_/$id/delete.tsx',
  'apps/web/src/routes/$locale/activity_.tsx',
  'apps/web/src/routes/$locale/activity/ai-tasks.tsx',
  'apps/web/src/routes/$locale/activity/ai-tasks_/$id/refresh.tsx',
  'apps/web/src/routes/$locale/activity/chats.tsx',
  'apps/web/src/routes/$locale/activity/feedbacks.tsx',
  'apps/web/src/routes/api/auth.ts',
  'apps/web/src/routes/api/auth/$.ts',
  'apps/web/src/routes/api/background-remover/cleanup.ts',
  'apps/web/src/routes/api/background-remover/download/$id.ts',
  'apps/web/src/routes/api/background-remover/remove.ts',
  'apps/web/src/routes/api/background-remover/result/$id.ts',
  'apps/web/src/routes/api/payment/callback.ts',
  'apps/web/src/routes/api/payment/checkout.ts',
  'apps/web/src/routes/api/payment/notify.ts',
  'apps/web/src/routes/api/remover/upload.ts',
  'apps/web/src/routes/api/remover/jobs.ts',
  'apps/web/src/routes/api/remover/jobs/$id.ts',
  'apps/web/src/routes/api/remover/download/low-res.ts',
  'apps/web/src/routes/api/remover/download/high-res.ts',
  'apps/web/src/routes/api/tts/history.ts',
  'apps/web/src/routes/api/tts/quota.ts',
  'apps/web/src/routes/api/tts/generate.ts',
  'apps/web/src/routes/api/tts/download/$id.ts',
  'apps/web/src/routes/api/user/get-user-credits.ts',
  'apps/web/src/routes/$locale/blog/category/$slug.tsx',
  'apps/web/src/server/api-context.ts',
  'apps/web/src/server/billing-runtime.ts',
  'apps/web/src/server/cloudflare-bindings.ts',
  'src/server/api/auth/auth-action.ts',
  'src/server/api/background-remover/actor.ts',
  'src/server/api/background-remover/guard.ts',
  'src/server/api/background-remover/routes.ts',
  'src/server/api/background-remover/routes-core.ts',
  'src/server/api/payment/callback-action.ts',
  'src/server/api/payment/checkout-action.ts',
  'src/server/api/payment/notify-action.ts',
  'src/server/api/remover/actor.ts',
  'src/server/api/remover/context.ts',
  'src/server/api/remover/download-action.ts',
  'src/server/api/remover/guard.ts',
  'src/server/api/remover/job-action.ts',
  'src/server/api/remover/jobs-action.ts',
  'src/server/api/remover/output-storage.ts',
  'src/server/api/remover/provider-adapter.ts',
  'src/server/api/remover/routes.ts',
  'src/server/api/remover/upload-action.ts',
  'src/server/api/storage/image-mime.ts',
  'src/server/api/tts/actor.ts',
  'src/server/api/tts/context.ts',
  'src/server/api/tts/generate-action.ts',
  'src/server/api/tts/guard.ts',
  'src/server/api/tts/guest-ip-limit.ts',
  'src/server/api/tts/provider.ts',
  'src/server/api/tts/routes.ts',
  'src/server/api/tts/routes-core.ts',
  'src/server/api/tts/routes.test.ts',
  'src/server/api/tts/turnstile.ts',
  'src/server/api/user/get-user-credits-action.ts',
  'src/shared/seo/canonical.ts',
  'src/shared/i18n/locale.ts',
  'src/shared/i18n/tanstack-paraglide.ts',
  'src/paraglide/messages.js',
  'src/paraglide/runtime.js',
  'src/domains/pricing/application/pricing-page.ts',
  'src/domains/content/application/public-content-manifest.ts',
  'src/server/pricing/pricing-page-messages.ts',
  'src/server/pricing/pricing-route-data.ts',
  'src/server/landing/home-route-data.ts',
  'src/server/landing/home-route-resolver.ts',
  'src/server/landing/landing-shell-data.ts',
  'src/server/landing/slug-route-data.ts',
  'src/server/landing/slug-route-resolver.ts',
  'src/server/landing/blog-index-route-data.ts',
  'src/server/landing/blog-index-route-resolver.ts',
  'src/server/landing/blog-post-route-data.ts',
  'src/server/landing/blog-post-route-resolver.ts',
  'src/server/landing/blog-category-route-data.ts',
  'src/server/landing/blog-category-route-resolver.ts',
  'src/server/member/member-entry-route-data.ts',
  'src/server/member/member-entry-route-resolver.ts',
  'src/server/member/settings-auth-redirect.ts',
  'src/server/member/activity-route-data.ts',
  'src/server/member/activity-route-resolver.ts',
  'src/server/member/activity-route-messages.ts',
  'src/server/member/activity-refresh-route-data.ts',
  'src/server/member/activity-refresh-route-resolver.ts',
  'src/server/member/settings-profile-route-data.ts',
  'src/server/member/settings-profile-route-resolver.ts',
  'src/server/member/settings-profile-route-messages.ts',
  'src/server/member/settings-security-route-data.ts',
  'src/server/member/settings-security-route-resolver.ts',
  'src/server/member/settings-security-route-messages.ts',
  'src/server/member/settings-credits-route-data.ts',
  'src/server/member/settings-credits-route-resolver.ts',
  'src/server/member/settings-credits-route-messages.ts',
  'src/server/member/settings-billing-route-data.ts',
  'src/server/member/settings-billing-route-resolver.ts',
  'src/server/member/settings-billing-route-messages.ts',
  'src/server/member/settings-billing-action-route-data.ts',
  'src/server/member/settings-billing-action-route-resolver.ts',
  'src/server/member/settings-payments-route-data.ts',
  'src/server/member/settings-payments-route-resolver.ts',
  'src/server/member/settings-payments-route-messages.ts',
  'src/server/member/settings-apikeys-route-data.ts',
  'src/server/member/settings-apikeys-route-resolver.ts',
  'src/server/member/settings-apikeys-route-messages.ts',
  'src/server/member/settings-apikeys-create-route-data.ts',
  'src/server/member/settings-apikeys-create-route-resolver.ts',
  'src/server/member/settings-apikeys-id-route-data.ts',
  'src/server/member/settings-apikeys-id-route-resolver.ts',
  'src/server/member/settings-shell-route-data.ts',
  'src/surfaces/landing/pricing/pricing.data.ts',
  'src/surfaces/landing/pricing/pricing.seo.ts',
  'src/surfaces/landing/pricing/pricing.view.tsx',
  'src/surfaces/landing/pricing/pricing.types.ts',
  'src/surfaces/landing/home/home.data.ts',
  'src/surfaces/landing/home/home.seo.ts',
  'src/surfaces/landing/home/home.view.tsx',
  'src/surfaces/landing/home/home.types.ts',
  'src/surfaces/landing/slug/slug.data.ts',
  'src/surfaces/landing/slug/slug.seo.ts',
  'src/surfaces/landing/slug/slug.view.tsx',
  'src/surfaces/landing/slug/slug.types.ts',
  'src/surfaces/landing/shell/landing-shell.view.tsx',
  'src/surfaces/landing/blog-index/blog-index.data.ts',
  'src/surfaces/landing/blog-index/blog-index.seo.ts',
  'src/surfaces/landing/blog-index/blog-index.view.tsx',
  'src/surfaces/landing/blog-index/blog-index.types.ts',
  'src/surfaces/landing/blog-post/blog-post.data.ts',
  'src/surfaces/landing/blog-post/blog-post.seo.ts',
  'src/surfaces/landing/blog-post/blog-post.view.tsx',
  'src/surfaces/landing/blog-post/blog-post.types.ts',
  'src/surfaces/landing/blog-category/blog-category.data.ts',
  'src/surfaces/landing/blog-category/blog-category.seo.ts',
  'src/surfaces/landing/blog-category/blog-category.view.tsx',
  'src/surfaces/landing/blog-category/blog-category.types.ts',
  'src/surfaces/member/member-entry/member-entry.data.ts',
  'src/surfaces/member/member-entry/member-entry.types.ts',
  'src/surfaces/member/activity/activity.data.ts',
  'src/surfaces/member/activity/activity.seo.ts',
  'src/surfaces/member/activity/activity.types.ts',
  'src/surfaces/member/activity/activity.view.tsx',
  'src/surfaces/member/activity-refresh/activity-refresh.data.ts',
  'src/surfaces/member/activity-refresh/activity-refresh.seo.ts',
  'src/surfaces/member/activity-refresh/activity-refresh.types.ts',
  'src/surfaces/member/activity-refresh/activity-refresh.view.tsx',
  'src/surfaces/member/settings-shell/settings-shell.types.ts',
  'src/surfaces/member/settings-shell/settings-shell.view.tsx',
  'src/surfaces/member/settings-profile/settings-profile.data.ts',
  'src/surfaces/member/settings-profile/settings-profile.seo.ts',
  'src/surfaces/member/settings-profile/settings-profile.types.ts',
  'src/surfaces/member/settings-profile/settings-profile.view.tsx',
  'src/surfaces/member/settings-security/settings-security.data.ts',
  'src/surfaces/member/settings-security/settings-security.seo.ts',
  'src/surfaces/member/settings-security/settings-security.types.ts',
  'src/surfaces/member/settings-security/settings-security.view.tsx',
  'src/surfaces/member/settings-credits/settings-credits.data.ts',
  'src/surfaces/member/settings-credits/settings-credits.seo.ts',
  'src/surfaces/member/settings-credits/settings-credits.types.ts',
  'src/surfaces/member/settings-credits/settings-credits.view.tsx',
  'src/surfaces/member/settings-billing/settings-billing.data.ts',
  'src/surfaces/member/settings-billing/settings-billing.seo.ts',
  'src/surfaces/member/settings-billing/settings-billing.types.ts',
  'src/surfaces/member/settings-billing/settings-billing.view.tsx',
  'src/surfaces/member/settings-billing-action/settings-billing-action.data.ts',
  'src/surfaces/member/settings-billing-action/settings-billing-action.seo.ts',
  'src/surfaces/member/settings-billing-action/settings-billing-action.types.ts',
  'src/surfaces/member/settings-billing-action/settings-billing-action.view.tsx',
  'src/surfaces/member/settings-payments/settings-payments.data.ts',
  'src/surfaces/member/settings-payments/settings-payments.seo.ts',
  'src/surfaces/member/settings-payments/settings-payments.types.ts',
  'src/surfaces/member/settings-payments/settings-payments.view.tsx',
  'src/surfaces/member/settings-apikeys/settings-apikeys.data.ts',
  'src/surfaces/member/settings-apikeys/settings-apikeys.seo.ts',
  'src/surfaces/member/settings-apikeys/settings-apikeys.types.ts',
  'src/surfaces/member/settings-apikeys/settings-apikeys.view.tsx',
  'src/surfaces/member/settings-apikeys-create/settings-apikeys-create.data.ts',
  'src/surfaces/member/settings-apikeys-create/settings-apikeys-create.seo.ts',
  'src/surfaces/member/settings-apikeys-create/settings-apikeys-create.types.ts',
  'src/surfaces/member/settings-apikeys-create/settings-apikeys-create.view.tsx',
  'src/surfaces/member/settings-apikeys-id/settings-apikeys-id.data.ts',
  'src/surfaces/member/settings-apikeys-id/settings-apikeys-id.seo.ts',
  'src/surfaces/member/settings-apikeys-id/settings-apikeys-id.types.ts',
  'src/surfaces/member/settings-apikeys-id/settings-apikeys-id.view.tsx',
  'src/surfaces/system/not-found/not-found.view.tsx',
  'scripts/tanstack-gate-4-plan.mjs',
  'docs/migration/gate-4-page-migration-plan.generated.md',
  'docs/migration/gate-1-3-tanstack-nativity-review.md',
  'docs/migration/gate-4-surface-taint-audit.md',
  'docs/migration/gate-4-a-slug-verification.md',
  'docs/migration/gate-4-b-member-entry-routes-spec.md',
  'project.inlang/settings.json',
  'messages/en.json',
  'messages/zh.json',
  'messages/zh-TW.json',
  'vite.config.mts',
  'tsconfig.tanstack.json',
];

for (const file of requiredFiles) {
  if (!existsSync(join(root, file))) {
    fail(`missing required file ${file}`);
  }
}

const surfaceTaintAuditFile = join(
  root,
  'docs/migration/gate-4-surface-taint-audit.md'
);
for (const [regex, label] of [
  [/TanStack page route closure forbids `server-only`/, 'page closure rule'],
  [
    /TanStack API routes are not page migrations/,
    'API route migration exception',
  ],
  [
    /Existing API route closure may still reach `server-only`/,
    'API server-only exception',
  ],
]) {
  if (!contains(surfaceTaintAuditFile, regex)) {
    fail(`surface taint audit must document ${label}`);
  }
}

const forbiddenFiles = [
  'src/app/api/payment/checkout/action.ts',
  'src/app/api/payment/notify/route-logic.ts',
  'src/app/api/user/get-user-credits/action.ts',
  'src/domains/pricing/application/pricing-page-messages.ts',
];

for (const file of forbiddenFiles) {
  if (existsSync(join(root, file))) {
    fail(`obsolete Gate 3.1 HTTP composition file must be removed: ${file}`);
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
  'tanstack:client-boundary',
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
if (!/tanstack:validate/.test(scripts.check || '')) {
  fail('check must include tanstack:validate');
}
if (!/tanstack:typecheck/.test(scripts.check || '')) {
  fail('check must include tanstack:typecheck');
}
if (!/tanstack:build/.test(scripts.ci || '')) {
  fail('ci must include tanstack:build');
}
if (!/tanstack:client-boundary/.test(scripts.ci || '')) {
  fail('ci must include tanstack:client-boundary');
}
if (/\$\{SITE:-/.test(scripts['tanstack:cf:build'] || '')) {
  fail('tanstack:cf:build must not default SITE');
}
if (!/SITE is required/.test(scripts['tanstack:cf:build'] || '')) {
  fail('tanstack:cf:build must require an explicit SITE');
}

const allDeps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
if (allDeps['@cloudflare/vite-plugin'] === '^2.2.0') {
  fail('@cloudflare/vite-plugin ^2.2.0 is not a valid baseline');
}
if (!allDeps['@inlang/paraglide-js']) {
  fail('@inlang/paraglide-js must be installed for TanStack i18n foundation');
}
if (pkg.devDependencies?.['@inlang/plugin-message-format'] !== '4.4.0') {
  fail(
    '@inlang/plugin-message-format 4.4.0 must be installed for local Paraglide compilation'
  );
}
if (!scripts['paraglide:compile']) {
  fail('missing Paraglide compile script');
}
if (!/paraglide-js compile/.test(scripts['paraglide:compile'] || '')) {
  fail('paraglide:compile must run the Paraglide compiler');
}

if (!legacyAppRetired) {
  try {
    execFileSync('node', ['scripts/tanstack-gate-4-plan.mjs', '--check'], {
      cwd: root,
      stdio: 'inherit',
    });
  } catch {
    fail('Gate 4 generated page migration matrix is stale');
  }
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
  [/@next\/next/, '@next/next rule reference'],
  [/@\/app\/api\//, '@/app/api import'],
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

const surfaceFiles = sourceFilesIn('src/surfaces');
const surfaceTaintPatterns = [
  [/^\s*import\s+['"]server-only['"]/m, 'server-only marker'],
  [/from\s+['"]next(?:\/|['"])/, 'next runtime import'],
  [/from\s+['"]next-intl\/server['"]/, 'next-intl/server import'],
  [/@\/app\//, '@/app import'],
  [/src\/app\//, 'src/app import'],
  [/src\/legacy\//, 'src/legacy import'],
  [/Metadata\s+from\s+['"]next['"]/, 'Next Metadata type import'],
  [/params\s*:\s*Promise/, 'params: Promise'],
  [/generateMetadata/, 'generateMetadata'],
  [/generateStaticParams/, 'generateStaticParams'],
];

for (const file of surfaceFiles) {
  for (const [regex, label] of surfaceTaintPatterns) {
    if (contains(file, regex)) {
      fail(`${label} found in surface layer: ${relative(root, file)}`);
    }
  }
}

const viteConfigFile = join(root, 'vite.config.mts');
if (!contains(viteConfigFile, /paraglideVitePlugin/)) {
  fail('vite.config.mts must include the Paraglide Vite plugin');
}
if (contains(viteConfigFile, /strategy:\s*\[[^\]]*['"]url['"]/s)) {
  fail('Paraglide foundation must not enable URL strategy in this phase');
}

const inlangSettingsFile = join(root, 'project.inlang/settings.json');
const inlangSettings = JSON.parse(readFileSync(inlangSettingsFile, 'utf8'));
const inlangModules = Array.isArray(inlangSettings.modules)
  ? inlangSettings.modules
  : [];
const localMessageFormatPlugin =
  './node_modules/@inlang/plugin-message-format/dist/index.js';

if (inlangModules.some((modulePath) => /^https?:\/\//.test(modulePath))) {
  fail('project.inlang/settings.json must not load remote Paraglide plugins');
}
if (!inlangModules.includes(localMessageFormatPlugin)) {
  fail(
    'project.inlang/settings.json must load the local message-format plugin'
  );
}
if (inlangModules.some((modulePath) => /m-function-matcher/.test(modulePath))) {
  fail(
    'project.inlang/settings.json must not load the Sherlock matcher plugin'
  );
}
if (!existsSync(join(root, localMessageFormatPlugin))) {
  fail('@inlang/plugin-message-format local plugin file is missing');
}

const tanstackParaglideFile = 'src/shared/i18n/tanstack-paraglide.ts';
const tanstackParaglideAbs = join(root, tanstackParaglideFile);
if (!contains(tanstackParaglideAbs, /@\/paraglide\/messages/)) {
  fail(`${tanstackParaglideFile} must use compiled Paraglide messages`);
}
if (contains(tanstackParaglideAbs, /next-intl|getScopedMessages/)) {
  fail(`${tanstackParaglideFile} must not use legacy i18n loaders`);
}

const notFoundSurfaceFile = 'src/surfaces/system/not-found/not-found.view.tsx';
const notFoundSurfaceAbs = join(root, notFoundSurfaceFile);
if (!contains(notFoundSurfaceAbs, /getTanStackNotFoundCopy/)) {
  fail(`${notFoundSurfaceFile} must consume TanStack Paraglide copy`);
}

const routeTreeFile = join(root, 'apps/web/src/routeTree.gen.ts');
const routeTreeSource = readFileSync(routeTreeFile, 'utf8');
const routeTreeImports = new Set(
  [...routeTreeSource.matchAll(/from\s+['"](\.\/routes\/[^'"]+)['"]/g)].map(
    (match) => match[1]
  )
);
const expectedRouteImports = new Set(
  walk(join(root, 'apps/web/src/routes'))
    .filter((file) => /\.(ts|tsx)$/.test(file))
    .map((file) => {
      const rel = normalizePath(relative(join(root, 'apps/web/src'), file));
      return `./${stripSourceExtension(rel)}`;
    })
);

for (const expectedImport of expectedRouteImports) {
  if (!routeTreeImports.has(expectedImport)) {
    fail(`routeTree.gen.ts missing route import ${expectedImport}`);
  }
}

for (const actualImport of routeTreeImports) {
  if (!expectedRouteImports.has(actualImport)) {
    fail(`routeTree.gen.ts has stale route import ${actualImport}`);
  }
}

for (const expectedImport of expectedRouteImports) {
  if (expectedImport === './routes/__root') continue;

  const routePath = importPathToRoutePath(expectedImport);
  if (!contains(routeTreeFile, new RegExp(`'${escapeRegex(routePath)}'`))) {
    fail(`routeTree.gen.ts missing route path ${routePath}`);
  }
  if (
    !contains(routeTreeFile, new RegExp(`id:\\s*'${escapeRegex(routePath)}'`))
  ) {
    fail(`routeTree.gen.ts missing route id ${routePath}`);
  }
  if (
    !contains(
      routeTreeFile,
      new RegExp(
        `fullPath:\\s*'${escapeRegex(routePathToFullPath(routePath))}'`
      )
    )
  ) {
    fail(
      `routeTree.gen.ts missing fullPath type ${routePathToFullPath(routePath)}`
    );
  }
}

const tanstackRouteClosureFiles = localRuntimeClosure(
  sourceFilesIn('apps/web/src'),
  { includeDynamicImports: false }
);
const tanstackRouteRuntimeForbiddenPatterns = [
  [/\bfrom\s+['"]next(?:\/|['"])/, 'next runtime import'],
  [/^\s*import\s+['"]next(?:\/|['"])/m, 'next side-effect import'],
  [/from\s+['"]next-intl\/server['"]/, 'next-intl/server import'],
  [/@\/shared\/lib\/next-cache|shared\/lib\/next-cache/, 'next-cache import'],
  [
    /@\/domains\/settings\/application\/settings-runtime\.query|domains\/settings\/application\/settings-runtime\.query/,
    'settings-runtime.query import',
  ],
  [/@\/app\/|src\/app\//, 'legacy app import'],
  [/@\/app\/_legacy\/|src\/app\/_legacy\//, 'app legacy helper import'],
  [/@\/legacy\/|src\/legacy\//, 'legacy helper import'],
  [/@\/themes\/|src\/themes\//, 'theme import'],
  [/React\.use\(Promise\.resolve/, 'legacy page wrapper'],
  [/generateMetadata/, 'generateMetadata'],
  [/generateStaticParams/, 'generateStaticParams'],
  [/params\s*:\s*Promise/, 'params: Promise'],
];

for (const file of tanstackRouteClosureFiles) {
  for (const [regex, label] of tanstackRouteRuntimeForbiddenPatterns) {
    if (contains(file, regex)) {
      fail(`${label} found in TanStack route closure: ${relative(root, file)}`);
    }
  }
}

const routeFiles = walk(join(root, 'apps/web/src/routes'))
  .filter((file) => /\.(ts|tsx)$/.test(file))
  .map((file) => normalizePath(relative(root, file)))
  .sort();
for (const file of routeFiles.filter(
  (routeFile) => routeFile !== 'apps/web/src/routes/__root.tsx'
)) {
  const abs = join(root, file);
  if (!contains(abs, /createFileRoute/)) {
    fail(`${file} must use createFileRoute`);
  }
}

const tanstackPageRouteFiles = routeFiles.filter(
  (file) => !file.includes('/api/')
);
const surfaceHelperExemptPageRoutes = new Set([
  'apps/web/src/routes/admin_.tsx',
  'apps/web/src/routes/admin/$.tsx',
  'apps/web/src/routes/$locale/admin_.tsx',
  'apps/web/src/routes/$locale/admin/$.tsx',
  'apps/web/src/routes/chat_.tsx',
  'apps/web/src/routes/chat/$.tsx',
  'apps/web/src/routes/$locale/chat_.tsx',
  'apps/web/src/routes/$locale/chat/$.tsx',
  'apps/web/src/routes/docs_.tsx',
  'apps/web/src/routes/$locale/docs_.tsx',
  'apps/web/src/routes/my-images.tsx',
  'apps/web/src/routes/$locale/my-images.tsx',
  'apps/web/src/routes/ads[.]txt.ts',
  'apps/web/src/routes/robots[.]txt.ts',
  'apps/web/src/routes/sitemap[.]xml.ts',
]);
const tanstackPageRouteClosureFiles = localRuntimeClosure(
  tanstackPageRouteFiles.map((file) => join(root, file)),
  { includeDynamicImports: false }
);
const tanstackPageRuntimeForbiddenPatterns = [
  [/\bfrom\s+['"]next(?:\/|['"])/, 'next runtime import'],
  [/^\s*import\s+['"]next(?:\/|['"])/m, 'next side-effect import'],
  [/from\s+['"]next-intl(?:\/|['"])/, 'next-intl import'],
  [/^\s*import\s+['"]server-only['"]/m, 'server-only marker'],
  [/@\/app\/|src\/app\//, 'legacy app import'],
  [/@\/app\/_legacy\/|src\/app\/_legacy\//, 'app legacy helper import'],
  [/@\/legacy\/|src\/legacy\//, 'legacy helper import'],
];

for (const file of tanstackPageRouteClosureFiles) {
  for (const [regex, label] of tanstackPageRuntimeForbiddenPatterns) {
    if (contains(file, regex)) {
      fail(
        `${label} found in TanStack page route closure: ${relative(root, file)}`
      );
    }
  }
}

const pageRouteForbiddenPatterns = [
  [/@\/domains\//, '@/domains import'],
  [/@\/themes\//, '@/themes import'],
  [/@\/app\//, '@/app import'],
  [/src\/app\//, 'src/app import'],
  [/new\s+Response\(\s*['"]Not found['"]/, 'plain not-found Response'],
  [/from\s+['"]next\//, 'next/* import'],
  [/from\s+['"]next-intl/, 'next-intl import'],
  [/React\.use\(Promise\.resolve/, 'legacy page wrapper'],
  [/generateMetadata/, 'generateMetadata'],
  [/generateStaticParams/, 'generateStaticParams'],
  [/params\s*:\s*Promise/, 'params: Promise'],
];

for (const file of tanstackPageRouteFiles) {
  const abs = join(root, file);
  for (const [regex, label] of pageRouteForbiddenPatterns) {
    if (contains(abs, regex)) {
      fail(`${file} must not contain ${label}`);
    }
  }
  if (
    !surfaceHelperExemptPageRoutes.has(file) &&
    !contains(abs, /@\/surfaces\//) &&
    !contains(abs, /notFoundComponent:\s*\w+/)
  ) {
    fail(`${file} must use a surface helper`);
  }
}

const rootRouteFile = 'apps/web/src/routes/__root.tsx';
const rootRouteAbs = join(root, rootRouteFile);
if (!contains(rootRouteAbs, /notFoundComponent:\s*NotFoundSurfaceView/)) {
  fail(`${rootRouteFile} must use the shared not-found surface`);
}
if (
  !contains(
    rootRouteAbs,
    /useLocation\(\{\s*select:\s*\(location\)\s*=>\s*location\.pathname\s*\}\)/
  )
) {
  fail(
    `${rootRouteFile} must derive document locale from the current location`
  );
}
if (!contains(rootRouteAbs, /getLocaleFromPathname\(\s*pathname\s*\)/)) {
  fail(
    `${rootRouteFile} must resolve localized html attributes before hydration`
  );
}
if (contains(rootRouteAbs, /<html\s+lang=\{defaultLocale\}/)) {
  fail(`${rootRouteFile} must not render defaultLocale for every route`);
}
if (
  contains(rootRouteAbs, /NotFoundRoute|new\s+Response\(\s*['"]Not found['"]/)
) {
  fail(
    `${rootRouteFile} must use TanStack notFoundComponent, not legacy 404 handling`
  );
}

const landingShellDataFile = 'src/server/landing/landing-shell-data.ts';
const landingShellDataAbs = join(root, landingShellDataFile);
for (const [regex, label] of [
  [/filterLandingNavItems/, 'landing nav visibility filter'],
  [/filterLandingButtons/, 'landing button visibility filter'],
  [/filterTanStackShellNavItems/, 'TanStack shell route availability filter'],
  [/userNavItems:\s*\[\]/, 'public shell user nav suppression'],
  [
    /normalizedUrl\s*===\s*['"]\/docs['"][\s\S]*normalizedUrl\.startsWith\(['"]\/docs\/['"]\)/,
    'docs route suppression until migration',
  ],
  [
    /normalizedUrl\s*===\s*['"]\/my-images['"][\s\S]*normalizedUrl\.startsWith\(['"]\/my-images\/['"]\)/,
    'my-images route suppression until migration',
  ],
]) {
  if (!contains(landingShellDataAbs, regex)) {
    fail(`${landingShellDataFile} must apply ${label}`);
  }
}

const landingShellViewFile =
  'src/surfaces/landing/shell/landing-shell.view.tsx';
const landingShellViewAbs = join(root, landingShellViewFile);
for (const [regex, label] of [
  [/item\.children/, 'nested nav item rendering'],
  [/<details\s+className="landing-shell-nav-group"/, 'child nav disclosure'],
  [/aria-label=\{ariaLabel\}/, 'provided nav aria labels'],
]) {
  if (!contains(landingShellViewAbs, regex)) {
    fail(`${landingShellViewFile} must apply ${label}`);
  }
}
if (contains(landingShellViewAbs, /item\.url\s*\|\|\s*['"]#['"]/)) {
  fail(`${landingShellViewFile} must not render missing nav URLs as # links`);
}

const protectedSettingsRouteFiles = sourceFilesIn('apps/web/src/routes')
  .map((file) => normalizePath(relative(root, file)))
  .filter((file) =>
    /^apps\/web\/src\/routes\/(?:\$locale\/)?settings\//.test(file)
  );
for (const file of protectedSettingsRouteFiles) {
  const abs = join(root, file);
  if (!contains(abs, /redirectUnsignedSettingsVisitor/)) {
    fail(`${file} must redirect unsigned settings visitors in the loader`);
  }
}

const defaultHomeRouteFile = 'apps/web/src/routes/index.tsx';
const defaultHomeRouteAbs = join(root, defaultHomeRouteFile);
if (!contains(defaultHomeRouteAbs, /throw\s+notFound\s*\(/)) {
  fail(
    `${defaultHomeRouteFile} must throw TanStack notFound() for missing data`
  );
}
for (const surfaceFile of [
  'home.data',
  'home.seo',
  'home.view',
  'home.types',
]) {
  if (
    !contains(
      defaultHomeRouteAbs,
      new RegExp(`@/surfaces/landing/home/${surfaceFile}`)
    )
  ) {
    fail(`${defaultHomeRouteFile} must use ${surfaceFile} surface helper`);
  }
}
if (!contains(defaultHomeRouteAbs, /defaultLocale/)) {
  fail(`${defaultHomeRouteFile} must load the default-locale home route`);
}
if (contains(defaultHomeRouteAbs, /to:\s*['"]\/pricing['"]/)) {
  fail(`${defaultHomeRouteFile} must not redirect to /pricing`);
}

const localizedHomeRouteFile = 'apps/web/src/routes/$locale_.tsx';
const localizedHomeRouteAbs = join(root, localizedHomeRouteFile);
if (existsSync(localizedHomeRouteAbs)) {
  fail(
    `${localizedHomeRouteFile} must not exist because it conflicts with root /$slug`
  );
}

const singleSegmentRouteFile = 'apps/web/src/routes/$slug.tsx';
const singleSegmentRouteAbs = join(root, singleSegmentRouteFile);
for (const surfaceFile of [
  'home.data',
  'home.seo',
  'home.view',
  'home.types',
]) {
  if (
    !contains(
      singleSegmentRouteAbs,
      new RegExp(`@/surfaces/landing/home/${surfaceFile}`)
    )
  ) {
    fail(
      `${singleSegmentRouteFile} must dispatch locale homes through ${surfaceFile}`
    );
  }
}
for (const surfaceFile of [
  'slug.data',
  'slug.seo',
  'slug.view',
  'slug.types',
]) {
  if (
    !contains(
      singleSegmentRouteAbs,
      new RegExp(`@/surfaces/landing/slug/${surfaceFile}`)
    )
  ) {
    fail(
      `${singleSegmentRouteFile} must keep default-locale slug handling via ${surfaceFile}`
    );
  }
}
for (const [regex, label] of [
  [/normalizeLocale\(\s*params\.slug\s*\)/, 'locale segment check'],
  [/loadHomeSurfaceData\(\s*locale\s*\)/, 'locale home branch'],
  [
    /throw\s+notFound\(\s*\{\s*data:\s*\{\s*locale\s*\}/,
    'missing locale home notFound',
  ],
  [
    /loadSlugSurfaceData\(\s*defaultLocale\s*,\s*params\.slug\s*\)/,
    'default slug branch',
  ],
  [/kind:\s*['"]home['"]/, 'home discriminator'],
  [/kind:\s*['"]slug['"]/, 'slug discriminator'],
]) {
  if (!contains(singleSegmentRouteAbs, regex)) {
    fail(`${singleSegmentRouteFile} must implement ${label}`);
  }
}

const homeRouteTreeFile = 'apps/web/src/routeTree.gen.ts';
const homeRouteTreeAbs = join(root, homeRouteTreeFile);
if (!contains(homeRouteTreeAbs, /fullPath:\s*'\/'/)) {
  fail(`${homeRouteTreeFile} must include / fullPath`);
}
if (contains(homeRouteTreeAbs, /fullPath:\s*'\/\$locale'/)) {
  fail(`${homeRouteTreeFile} must not include root /$locale fullPath`);
}
if (contains(homeRouteTreeAbs, /LocaleRouteImport|LocaleRoute:/)) {
  fail(`${homeRouteTreeFile} must not include the deleted root locale route`);
}
if (!contains(homeRouteTreeAbs, /fullPath:\s*'\/\$slug'/)) {
  fail(
    `${homeRouteTreeFile} must keep /$slug fullPath for single-segment dispatch`
  );
}

const authRouteModes = [
  ['sign-in', '/sign-in'],
  ['sign-up', '/sign-up'],
  ['forgot-password', '/forgot-password'],
  ['reset-password', '/reset-password'],
  ['no-permission', '/no-permission'],
];
const authRouteFiles = authRouteModes.flatMap(([mode, path]) => [
  {
    file: `apps/web/src/routes/${path.slice(1)}.tsx`,
    path,
    mode,
    localePattern: /defaultLocale/,
  },
  {
    file: `apps/web/src/routes/$locale/${path.slice(1)}.tsx`,
    path: `/$locale${path}`,
    mode,
    localePattern: /params\.locale/,
  },
]);

for (const { file, path, mode, localePattern } of authRouteFiles) {
  const abs = join(root, file);
  if (!existsSync(abs)) {
    fail(`${file} must exist for Gate 4-B.1 auth routes`);
  }
  if (!contains(abs, /createFileRoute/)) {
    fail(`${file} must use createFileRoute`);
  }
  if (
    !contains(abs, new RegExp(`createFileRoute\\('${escapeRegex(path)}'\\)`))
  ) {
    fail(`${file} must declare TanStack route ${path}`);
  }
  if (!contains(abs, /loadAuthRouteSurfaceData/)) {
    fail(`${file} must load auth route surface data`);
  }
  if (!contains(abs, /getAuthRouteSurfaceHead/)) {
    fail(`${file} must use auth route surface head`);
  }
  if (!contains(abs, /AuthRouteView/)) {
    fail(`${file} must render AuthRouteView`);
  }
  if (!contains(abs, new RegExp(`mode:\\s*['"]${mode}['"]`))) {
    fail(`${file} must pass auth route mode ${mode}`);
  }
  if (!contains(abs, localePattern)) {
    fail(`${file} must use the expected locale source`);
  }
}

for (const [, path] of authRouteModes) {
  for (const fullPath of [path, `/$locale${path}`]) {
    if (
      !contains(
        homeRouteTreeAbs,
        new RegExp(`fullPath:\\s*'${escapeRegex(fullPath)}'`)
      )
    ) {
      fail(`${homeRouteTreeFile} must include auth fullPath ${fullPath}`);
    }
  }
}

const authRouteDataFile = 'src/server/auth/auth-route-data.ts';
const authRouteDataAbs = join(root, authRouteDataFile);
if (!contains(authRouteDataAbs, /createServerFn\(\{\s*method:\s*['"]GET['"]/)) {
  fail(`${authRouteDataFile} must use createServerFn({ method: 'GET' })`);
}
if (
  !contains(
    authRouteDataAbs,
    /await\s+import\(['"].\/auth-route-resolver['"]\)/
  )
) {
  fail(`${authRouteDataFile} must dynamically import the auth resolver`);
}

const authRouteResolverFile = 'src/server/auth/auth-route-resolver.ts';
const authRouteResolverAbs = join(root, authRouteResolverFile);
for (const [regex, label] of [
  [/readAuthUiRuntimeSettingsFresh/, 'fresh runtime auth UI settings'],
  [/readPublicUiConfigFresh/, 'fresh runtime public UI config'],
  [/normalizeLocale/, 'locale normalization'],
  [/loadAuthRouteMessages/, 'auth messages loader'],
]) {
  if (!contains(authRouteResolverAbs, regex)) {
    fail(`${authRouteResolverFile} must use ${label}`);
  }
}
if (contains(authRouteResolverAbs, /isPublishedLocaleForPath/)) {
  fail(`${authRouteResolverFile} must not gate auth routes on page publishing`);
}
for (const [regex, label] of [
  [/next-intl/, 'next-intl import'],
  [/next\/navigation/, 'next/navigation import'],
  [/@\/app\/|src\/app\//, 'legacy app import'],
  [/@\/themes\//, '@/themes import'],
]) {
  if (contains(authRouteResolverAbs, regex)) {
    fail(`${authRouteResolverFile} must not depend on ${label}`);
  }
}

const authSurfaceFiles = walk(join(root, 'src/surfaces/auth/auth-route'))
  .filter((file) => /\.(ts|tsx)$/.test(file))
  .map((file) => normalizePath(relative(root, file)))
  .sort();
for (const file of authSurfaceFiles) {
  const abs = join(root, file);
  for (const [regex, label] of [
    [/\bfrom\s+['"]next(?:\/|['"])/, 'next runtime import'],
    [/^\s*import\s+['"]next(?:\/|['"])/m, 'next side-effect import'],
    [/from\s+['"]next-intl(?:\/|['"])/, 'next-intl import'],
    [/@\/infra\/platform\/i18n\/navigation/, 'Next i18n navigation import'],
    [/@\/app\/|src\/app\//, 'legacy app import'],
    [/@\/themes\//, '@/themes import'],
    [/^\s*import\s+['"]server-only['"]/m, 'server-only marker'],
    [
      /@\/domains\/account\/ui\/auth\/(sign-in|sign-up|forgot-password|reset-password|sign-modal|sign-user|sign-in-form|social-providers)(?:['"]|$)/,
      'legacy auth UI component import',
    ],
  ]) {
    if (contains(abs, regex)) {
      fail(`${file} must not depend on ${label}`);
    }
  }
}

for (const legacyAuthFile of [
  'src/app/[locale]/(auth)/layout.tsx',
  'src/app/[locale]/(auth)/sign-in/page.tsx',
  'src/app/[locale]/(auth)/sign-up/page.tsx',
  'src/app/[locale]/(auth)/forgot-password/page.tsx',
  'src/app/[locale]/(auth)/reset-password/page.tsx',
  'src/app/[locale]/(auth)/no-permission/page.tsx',
]) {
  if (!existsSync(join(root, legacyAuthFile))) {
    fail(`${legacyAuthFile} must remain until legacy app routes are retired`);
  }
}

const memberEntryRouteFiles = [
  {
    file: 'apps/web/src/routes/settings_.tsx',
    routeId: '/settings_',
    kind: 'settings',
    localePattern: /defaultLocale/,
  },
  {
    file: 'apps/web/src/routes/activity_.tsx',
    routeId: '/activity_',
    kind: 'activity',
    localePattern: /defaultLocale/,
  },
  {
    file: 'apps/web/src/routes/$locale/settings_.tsx',
    routeId: '/$locale/settings_',
    kind: 'settings',
    localePattern: /params\.locale/,
  },
  {
    file: 'apps/web/src/routes/$locale/activity_.tsx',
    routeId: '/$locale/activity_',
    kind: 'activity',
    localePattern: /params\.locale/,
  },
];

for (const { file, routeId, kind, localePattern } of memberEntryRouteFiles) {
  const abs = join(root, file);
  if (!existsSync(abs)) {
    fail(`${file} must exist for Gate 4-B.2 member entry routes`);
  }
  if (!contains(abs, /createFileRoute/)) {
    fail(`${file} must use createFileRoute`);
  }
  if (
    !contains(abs, new RegExp(`createFileRoute\\('${escapeRegex(routeId)}'\\)`))
  ) {
    fail(`${file} must declare TanStack route ${routeId}`);
  }
  if (!contains(abs, /loadMemberEntryRouteData/)) {
    fail(`${file} must load member entry route data`);
  }
  if (!contains(abs, /redirect\(\{\s*href:\s*data\.redirectTo/)) {
    fail(`${file} must redirect to member entry route data`);
  }
  if (!contains(abs, new RegExp(`kind:\\s*['"]${kind}['"]`))) {
    fail(`${file} must pass member entry kind ${kind}`);
  }
  if (!contains(abs, localePattern)) {
    fail(`${file} must use the expected locale source`);
  }
}

for (const fullPath of [
  '/settings',
  '/activity',
  '/$locale/settings',
  '/$locale/activity',
]) {
  if (
    !contains(
      homeRouteTreeAbs,
      new RegExp(`fullPath:\\s*'${escapeRegex(fullPath)}'`)
    )
  ) {
    fail(`${homeRouteTreeFile} must include member entry fullPath ${fullPath}`);
  }
}

for (const file of [
  'apps/web/src/routes/settings.tsx',
  'apps/web/src/routes/activity.tsx',
  'apps/web/src/routes/$locale/settings.tsx',
  'apps/web/src/routes/$locale/activity.tsx',
]) {
  if (existsSync(join(root, file))) {
    fail(`${file} must not be introduced for member entry redirects`);
  }
}

const memberEntryDataFile = 'src/server/member/member-entry-route-data.ts';
const memberEntryDataAbs = join(root, memberEntryDataFile);
if (
  !contains(memberEntryDataAbs, /createServerFn\(\{\s*method:\s*['"]GET['"]/)
) {
  fail(`${memberEntryDataFile} must use createServerFn({ method: 'GET' })`);
}
if (
  !contains(
    memberEntryDataAbs,
    /await\s+import\(\s*['"].\/member-entry-route-resolver['"]\s*\)/
  )
) {
  fail(
    `${memberEntryDataFile} must dynamically import the member entry resolver`
  );
}

const memberEntryResolverFile =
  'src/server/member/member-entry-route-resolver.ts';
const memberEntryResolverAbs = join(root, memberEntryResolverFile);
for (const [regex, label] of [
  [/normalizeLocale/, 'locale normalization'],
  [/readPublicUiConfigFresh/, 'fresh runtime public UI config'],
  [/isAiEnabled/, 'activity AI enablement gate'],
  [/localePath/, 'localized redirect target builder'],
]) {
  if (!contains(memberEntryResolverAbs, regex)) {
    fail(`${memberEntryResolverFile} must use ${label}`);
  }
}
for (const [regex, label] of [
  [/getSignedInUserSnapshot|session\.server/, 'user session read'],
  [/ConsoleLayout|PublicAppProvider|AuthSnapshotProvider/, 'member shell'],
  [/next-intl/, 'next-intl import'],
  [/next\/navigation/, 'next/navigation import'],
  [/@\/app\/|src\/app\//, 'legacy app import'],
  [/@\/themes\//, '@/themes import'],
]) {
  if (contains(memberEntryResolverAbs, regex)) {
    fail(`${memberEntryResolverFile} must not depend on ${label}`);
  }
}

const memberEntrySurfaceFiles = walk(
  join(root, 'src/surfaces/member/member-entry')
)
  .filter((file) => /\.(ts|tsx)$/.test(file))
  .map((file) => normalizePath(relative(root, file)))
  .sort();
for (const file of memberEntrySurfaceFiles) {
  const abs = join(root, file);
  for (const [regex, label] of [
    [/\bfrom\s+['"]next(?:\/|['"])/, 'next runtime import'],
    [/^\s*import\s+['"]next(?:\/|['"])/m, 'next side-effect import'],
    [/from\s+['"]next-intl(?:\/|['"])/, 'next-intl import'],
    [/@\/infra\/platform\/i18n\/navigation/, 'Next i18n navigation import'],
    [/@\/app\/|src\/app\//, 'legacy app import'],
    [/@\/themes\//, '@/themes import'],
    [/^\s*import\s+['"]server-only['"]/m, 'server-only marker'],
    [/getSignedInUserSnapshot|session\.server/, 'user session read'],
  ]) {
    if (contains(abs, regex)) {
      fail(`${file} must not depend on ${label}`);
    }
  }
}

const activityRouteFiles = [
  {
    file: 'apps/web/src/routes/activity/ai-tasks.tsx',
    routeId: '/activity/ai-tasks',
    kind: 'ai-tasks',
    localePattern: /defaultLocale/,
  },
  {
    file: 'apps/web/src/routes/activity/chats.tsx',
    routeId: '/activity/chats',
    kind: 'chats',
    localePattern: /defaultLocale/,
  },
  {
    file: 'apps/web/src/routes/activity/feedbacks.tsx',
    routeId: '/activity/feedbacks',
    kind: 'feedbacks',
    localePattern: /defaultLocale/,
  },
  {
    file: 'apps/web/src/routes/$locale/activity/ai-tasks.tsx',
    routeId: '/$locale/activity/ai-tasks',
    kind: 'ai-tasks',
    localePattern: /params\.locale/,
  },
  {
    file: 'apps/web/src/routes/$locale/activity/chats.tsx',
    routeId: '/$locale/activity/chats',
    kind: 'chats',
    localePattern: /params\.locale/,
  },
  {
    file: 'apps/web/src/routes/$locale/activity/feedbacks.tsx',
    routeId: '/$locale/activity/feedbacks',
    kind: 'feedbacks',
    localePattern: /params\.locale/,
  },
];

for (const { file, routeId, kind, localePattern } of activityRouteFiles) {
  const abs = join(root, file);
  if (!existsSync(abs)) {
    fail(`${file} must exist for Gate 4-B.4 activity list routes`);
  }
  if (!contains(abs, /createFileRoute/)) {
    fail(`${file} must use createFileRoute`);
  }
  if (
    !contains(abs, new RegExp(`createFileRoute\\('${escapeRegex(routeId)}'\\)`))
  ) {
    fail(`${file} must declare TanStack route ${routeId}`);
  }
  if (!contains(abs, /loadActivityRouteSurfaceData/)) {
    fail(`${file} must load activity route surface data`);
  }
  if (!contains(abs, /getActivityRouteSurfaceHead/)) {
    fail(`${file} must use activity route surface head`);
  }
  if (!contains(abs, /ActivityRouteView/)) {
    fail(`${file} must render ActivityRouteView`);
  }
  if (!contains(abs, new RegExp(`kind:\\s*['"]${kind}['"]`))) {
    fail(`${file} must pass activity kind ${kind}`);
  }
  if (!contains(abs, localePattern)) {
    fail(`${file} must use the expected locale source`);
  }
}

const activityRefreshRouteFiles = [
  {
    file: 'apps/web/src/routes/activity/ai-tasks_/$id/refresh.tsx',
    routeId: '/activity/ai-tasks_/$id/refresh',
    localePattern: /defaultLocale/,
  },
  {
    file: 'apps/web/src/routes/$locale/activity/ai-tasks_/$id/refresh.tsx',
    routeId: '/$locale/activity/ai-tasks_/$id/refresh',
    localePattern: /params\.locale/,
  },
];

for (const { file, routeId, localePattern } of activityRefreshRouteFiles) {
  const abs = join(root, file);
  if (!existsSync(abs)) {
    fail(`${file} must exist for Gate 4-B.4 AI task refresh routes`);
  }
  if (!contains(abs, /createFileRoute/)) {
    fail(`${file} must use createFileRoute`);
  }
  if (
    !contains(abs, new RegExp(`createFileRoute\\('${escapeRegex(routeId)}'\\)`))
  ) {
    fail(`${file} must declare TanStack route ${routeId}`);
  }
  if (!contains(abs, /loadActivityRefreshRouteSurfaceData/)) {
    fail(`${file} must load activity refresh route surface data`);
  }
  if (!contains(abs, /getActivityRefreshRouteSurfaceHead/)) {
    fail(`${file} must use activity refresh route surface head`);
  }
  if (!contains(abs, /ActivityRefreshRouteView/)) {
    fail(`${file} must render ActivityRefreshRouteView`);
  }
  if (!contains(abs, /id:\s*params\.id/)) {
    fail(`${file} must pass params.id`);
  }
  if (!contains(abs, /redirect\(\{\s*href:\s*data\.redirectTo/)) {
    fail(`${file} must redirect on successful refresh route data`);
  }
  if (!contains(abs, localePattern)) {
    fail(`${file} must use the expected locale source`);
  }
}

for (const fullPath of [
  '/activity/ai-tasks',
  '/activity/chats',
  '/activity/feedbacks',
  '/activity/ai-tasks/$id/refresh',
  '/$locale/activity/ai-tasks',
  '/$locale/activity/chats',
  '/$locale/activity/feedbacks',
  '/$locale/activity/ai-tasks/$id/refresh',
]) {
  if (
    !contains(
      homeRouteTreeAbs,
      new RegExp(`fullPath:\\s*'${escapeRegex(fullPath)}'`)
    )
  ) {
    fail(`${homeRouteTreeFile} must include activity fullPath ${fullPath}`);
  }
}

const activityDataFile = 'src/server/member/activity-route-data.ts';
const activityDataAbs = join(root, activityDataFile);
if (!contains(activityDataAbs, /createServerFn\(\{\s*method:\s*['"]GET['"]/)) {
  fail(`${activityDataFile} must use createServerFn({ method: 'GET' })`);
}
if (
  !contains(
    activityDataAbs,
    /await\s+import\(\s*['"].\/activity-route-resolver['"]\s*\)/
  )
) {
  fail(`${activityDataFile} must dynamically import the activity resolver`);
}

const activityResolverFile = 'src/server/member/activity-route-resolver.ts';
const activityResolverAbs = join(root, activityResolverFile);
for (const [regex, label] of [
  [/normalizeLocale/, 'locale normalization'],
  [/readPublicUiConfigFresh/, 'fresh runtime public UI config'],
  [/isAiEnabled/, 'activity AI enablement gate'],
  [/getSignedInUserIdentityFromRequest/, 'TanStack request auth reader'],
  [/listMemberAiTasksQuery/, 'member AI tasks query'],
  [/listMemberChatsQuery/, 'member chats query'],
  [/loadActivityRouteMessages/, 'activity message loader'],
  [/safeJsonParse/, 'AI task result parsing'],
  [/localePath/, 'localized links'],
  [/JSON\.stringify/, 'route data serializability guard'],
  [/noindex,nofollow/, 'member noindex robots head'],
]) {
  if (!contains(activityResolverAbs, regex)) {
    fail(`${activityResolverFile} must use ${label}`);
  }
}
for (const [regex, label] of [
  [/localePath\(['"]\/chat['"]/, 'unmigrated chat create action'],
  [/\/chat\/\$\{row\.id\}/, 'unmigrated chat view action'],
]) {
  if (contains(activityResolverAbs, regex)) {
    fail(`${activityResolverFile} must not expose ${label}`);
  }
}
for (const [regex, label] of [
  [/getSignedInUserSnapshot|session\.server/, 'legacy Next session server'],
  [
    /ConsoleLayout|PublicAppProvider|AuthSnapshotProvider/,
    'legacy member shell',
  ],
  [/TableCard/, 'legacy table card'],
  [/next-intl/, 'next-intl import'],
  [/next\/navigation/, 'next/navigation import'],
  [/@\/app\/|src\/app\//, 'legacy app import'],
  [/@\/themes\//, '@/themes import'],
]) {
  if (contains(activityResolverAbs, regex)) {
    fail(`${activityResolverFile} must not depend on ${label}`);
  }
}

const activityMessagesFile = 'src/server/member/activity-route-messages.ts';
const activityMessagesAbs = join(root, activityMessagesFile);
for (const [regex, label] of [
  [/activity\/sidebar/, 'activity/sidebar messages'],
  [/activity\/ai-tasks/, 'activity/ai-tasks messages'],
  [/activity\/chats/, 'activity/chats messages'],
  [/mergeDeep/, 'key-level fallback merge'],
]) {
  if (!contains(activityMessagesAbs, regex)) {
    fail(`${activityMessagesFile} must implement ${label}`);
  }
}

const activityRefreshDataFile =
  'src/server/member/activity-refresh-route-data.ts';
const activityRefreshDataAbs = join(root, activityRefreshDataFile);
if (
  !contains(
    activityRefreshDataAbs,
    /createServerFn\(\{\s*method:\s*['"]GET['"]/
  )
) {
  fail(`${activityRefreshDataFile} must use createServerFn({ method: 'GET' })`);
}
if (
  !contains(
    activityRefreshDataAbs,
    /await\s+import\(\s*['"].\/activity-refresh-route-resolver['"]\s*\)/
  )
) {
  fail(
    `${activityRefreshDataFile} must dynamically import the activity refresh resolver`
  );
}

const activityRefreshResolverFile =
  'src/server/member/activity-refresh-route-resolver.ts';
const activityRefreshResolverAbs = join(root, activityRefreshResolverFile);
for (const [regex, label] of [
  [/normalizeLocale/, 'locale normalization'],
  [/readPublicUiConfigFresh/, 'fresh runtime public UI config'],
  [/isAiEnabled/, 'activity AI enablement gate'],
  [/getSignedInUserIdentityFromRequest/, 'TanStack request auth reader'],
  [/refreshMemberAiTaskUseCase/, 'member AI task refresh use case'],
  [/loadActivityRouteMessages/, 'activity message loader'],
  [/localePath/, 'localized redirect and back link'],
  [/JSON\.stringify/, 'route data serializability guard'],
  [/noindex,nofollow/, 'member noindex robots head'],
]) {
  if (!contains(activityRefreshResolverAbs, regex)) {
    fail(`${activityRefreshResolverFile} must use ${label}`);
  }
}
for (const [regex, label] of [
  [/getSignedInUserSnapshot|session\.server/, 'legacy Next session server'],
  [/next-intl/, 'next-intl import'],
  [/next\/navigation/, 'next/navigation import'],
  [/@\/app\/|src\/app\//, 'legacy app import'],
  [/@\/themes\//, '@/themes import'],
]) {
  if (contains(activityRefreshResolverAbs, regex)) {
    fail(`${activityRefreshResolverFile} must not depend on ${label}`);
  }
}

for (const dir of [
  'src/surfaces/member/activity',
  'src/surfaces/member/activity-refresh',
]) {
  const surfaceFiles = walk(join(root, dir))
    .filter((file) => /\.(ts|tsx)$/.test(file))
    .map((file) => normalizePath(relative(root, file)))
    .sort();
  for (const file of surfaceFiles) {
    const abs = join(root, file);
    for (const [regex, label] of [
      [/\bfrom\s+['"]next(?:\/|['"])/, 'next runtime import'],
      [/^\s*import\s+['"]next(?:\/|['"])/m, 'next side-effect import'],
      [/from\s+['"]next-intl(?:\/|['"])/, 'next-intl import'],
      [/@\/infra\/platform\/i18n\/navigation/, 'Next i18n navigation import'],
      [/@\/app\/|src\/app\//, 'legacy app import'],
      [/@\/themes\//, '@/themes import'],
      [/^\s*import\s+['"]server-only['"]/m, 'server-only marker'],
      [/session\.server/, 'legacy Next session server'],
      [/TableCard/, 'legacy table card'],
    ]) {
      if (contains(abs, regex)) {
        fail(`${file} must not depend on ${label}`);
      }
    }
  }
}

const activityViewFile = 'src/surfaces/member/activity/activity.view.tsx';
const activityViewAbs = join(root, activityViewFile);
for (const [regex, label] of [
  [/document\.documentElement\.lang\s*=\s*data\.locale/, 'localized html lang'],
  [/document\.documentElement\.dir\s*=\s*isRtlLocale/, 'localized html dir'],
  [/data\.page\.rows/, 'plain serializable activity table'],
  [/row\.actions/, 'activity row actions'],
]) {
  if (!contains(activityViewAbs, regex)) {
    fail(`${activityViewFile} must apply ${label}`);
  }
}

const activityRefreshViewFile =
  'src/surfaces/member/activity-refresh/activity-refresh.view.tsx';
const activityRefreshViewAbs = join(root, activityRefreshViewFile);
for (const [regex, label] of [
  [/document\.documentElement\.lang\s*=\s*data\.locale/, 'localized html lang'],
  [/document\.documentElement\.dir\s*=\s*isRtlLocale/, 'localized html dir'],
  [/data\.page\.message/, 'refresh message rendering'],
  [/data\.page\.backHref/, 'refresh back link rendering'],
]) {
  if (!contains(activityRefreshViewAbs, regex)) {
    fail(`${activityRefreshViewFile} must apply ${label}`);
  }
}

for (const legacyActivityFile of [
  'src/app/[locale]/(landing)/activity/ai-tasks/page.tsx',
  'src/app/[locale]/(landing)/activity/ai-tasks/[id]/refresh/page.tsx',
  'src/app/[locale]/(landing)/activity/chats/page.tsx',
  'src/app/[locale]/(landing)/activity/feedbacks/page.tsx',
]) {
  if (!existsSync(join(root, legacyActivityFile))) {
    fail(
      `${legacyActivityFile} must remain until the legacy app route is retired`
    );
  }
}

const settingsProfileRouteFiles = [
  {
    file: 'apps/web/src/routes/settings/profile.tsx',
    routeId: '/settings/profile',
    localePattern: /defaultLocale/,
  },
  {
    file: 'apps/web/src/routes/$locale/settings/profile.tsx',
    routeId: '/$locale/settings/profile',
    localePattern: /params\.locale/,
  },
];

for (const { file, routeId, localePattern } of settingsProfileRouteFiles) {
  const abs = join(root, file);
  if (!existsSync(abs)) {
    fail(`${file} must exist for Gate 4-B.3b settings profile route`);
  }
  if (!contains(abs, /createFileRoute/)) {
    fail(`${file} must use createFileRoute`);
  }
  if (
    !contains(abs, new RegExp(`createFileRoute\\('${escapeRegex(routeId)}'\\)`))
  ) {
    fail(`${file} must declare TanStack route ${routeId}`);
  }
  if (!contains(abs, /loadSettingsProfileRouteSurfaceData/)) {
    fail(`${file} must load settings profile route surface data`);
  }
  if (!contains(abs, /getSettingsProfileRouteSurfaceHead/)) {
    fail(`${file} must use settings profile route surface head`);
  }
  if (!contains(abs, /SettingsProfileRouteView/)) {
    fail(`${file} must render SettingsProfileRouteView`);
  }
  if (!contains(abs, localePattern)) {
    fail(`${file} must use the expected locale source`);
  }
}

for (const fullPath of ['/settings/profile', '/$locale/settings/profile']) {
  if (
    !contains(
      homeRouteTreeAbs,
      new RegExp(`fullPath:\\s*'${escapeRegex(fullPath)}'`)
    )
  ) {
    fail(
      `${homeRouteTreeFile} must include settings profile fullPath ${fullPath}`
    );
  }
}

const settingsProfileDataFile =
  'src/server/member/settings-profile-route-data.ts';
const settingsProfileDataAbs = join(root, settingsProfileDataFile);
if (
  !contains(
    settingsProfileDataAbs,
    /createServerFn\(\{\s*method:\s*['"]GET['"]/
  )
) {
  fail(`${settingsProfileDataFile} must use createServerFn({ method: 'GET' })`);
}
if (
  !contains(
    settingsProfileDataAbs,
    /createServerFn\(\{\s*method:\s*['"]POST['"]/
  )
) {
  fail(
    `${settingsProfileDataFile} must use createServerFn({ method: 'POST' })`
  );
}
if (!contains(settingsProfileDataAbs, /submitSettingsProfileRouteData/)) {
  fail(`${settingsProfileDataFile} must expose settings profile update data`);
}
if (
  !contains(
    settingsProfileDataAbs,
    /await\s+import\(\s*['"].\/settings-profile-route-resolver['"]\s*\)/
  )
) {
  fail(
    `${settingsProfileDataFile} must dynamically import the settings profile resolver`
  );
}

const settingsProfileResolverFile =
  'src/server/member/settings-profile-route-resolver.ts';
const settingsProfileResolverAbs = join(root, settingsProfileResolverFile);
for (const [regex, label] of [
  [/normalizeLocale/, 'locale normalization'],
  [/loadSettingsProfileRouteMessages/, 'settings profile message loader'],
  [/readSignedInUserIdentity|getSignedInUserIdentity/, 'signed-in user check'],
  [/viewer:\s*\{\s*signedIn/s, 'signed-in boolean route data'],
  [/profile:\s*signedInUser/s, 'profile read data'],
  [/email:\s*signedInUser\.email/s, 'profile email projection'],
  [/name:\s*signedInUser\.name/s, 'profile name projection'],
  [/image:\s*signedInUser\.image/s, 'profile image projection'],
  [/resolveSettingsProfileUpdate/, 'profile update resolver'],
  [/updateProfileUseCase/, 'profile mutation use case'],
  [/normalizeProfileImageValue/, 'profile image URL normalization'],
  [/JSON\.stringify/, 'route data serializability guard'],
  [/noindex,nofollow/, 'member noindex robots head'],
]) {
  if (!contains(settingsProfileResolverAbs, regex)) {
    fail(`${settingsProfileResolverFile} must use ${label}`);
  }
}
for (const [regex, label] of [
  [/accountRuntimeDeps/, 'legacy account runtime deps'],
  [/requireActionUser/, 'legacy action user guard'],
  [/FormCard/, 'legacy form card'],
  [/withAction/, 'legacy server action helper'],
  [/parseFormData/, 'legacy form parser'],
  [/upload_image/, 'upload image field'],
  [/next\/headers/, 'next/headers import'],
  [/session\.server/, 'legacy Next session server'],
  [
    /ConsoleLayout|LandingLayout|PublicAppProvider|AuthSnapshotProvider/,
    'legacy member shell',
  ],
  [/next-intl/, 'next-intl import'],
  [/next\/navigation/, 'next/navigation import'],
  [/@\/app\/|src\/app\//, 'legacy app import'],
  [/@\/themes\//, '@/themes import'],
]) {
  if (contains(settingsProfileResolverAbs, regex)) {
    fail(`${settingsProfileResolverFile} must not depend on ${label}`);
  }
}

const settingsProfileMessagesFile =
  'src/server/member/settings-profile-route-messages.ts';
const settingsProfileMessagesAbs = join(root, settingsProfileMessagesFile);
for (const [regex, label] of [
  [/settings\/profile/, 'settings/profile messages'],
  [/settings\/sidebar/, 'settings/sidebar messages'],
  [
    /\?\s*\(mergeDeep\(baseProfile/,
    'base fallback for missing profile messages',
  ],
  [
    /\?\s*\(mergeDeep\(baseSidebar/,
    'base fallback for missing sidebar messages',
  ],
  [/mergeDeep/, 'key-level fallback merge'],
]) {
  if (!contains(settingsProfileMessagesAbs, regex)) {
    fail(`${settingsProfileMessagesFile} must implement ${label}`);
  }
}

const settingsProfileSurfaceFiles = walk(
  join(root, 'src/surfaces/member/settings-profile')
)
  .filter((file) => /\.(ts|tsx)$/.test(file))
  .map((file) => normalizePath(relative(root, file)))
  .sort();
for (const file of settingsProfileSurfaceFiles) {
  const abs = join(root, file);
  for (const [regex, label] of [
    [/\bfrom\s+['"]next(?:\/|['"])/, 'next runtime import'],
    [/^\s*import\s+['"]next(?:\/|['"])/m, 'next side-effect import'],
    [/from\s+['"]next-intl(?:\/|['"])/, 'next-intl import'],
    [/@\/infra\/platform\/i18n\/navigation/, 'Next i18n navigation import'],
    [/@\/app\/|src\/app\//, 'legacy app import'],
    [/@\/themes\//, '@/themes import'],
    [/^\s*import\s+['"]server-only['"]/m, 'server-only marker'],
    [/session\.server/, 'legacy Next session server'],
    [/FormCard|withAction|parseFormData/, 'legacy profile mutation helper'],
    [/upload_image/, 'upload image field'],
  ]) {
    if (contains(abs, regex)) {
      fail(`${file} must not depend on ${label}`);
    }
  }
}

const settingsProfileViewFile =
  'src/surfaces/member/settings-profile/settings-profile.view.tsx';
const settingsProfileViewAbs = join(root, settingsProfileViewFile);
for (const [regex, label] of [
  [/document\.documentElement\.lang\s*=\s*data\.locale/, 'localized html lang'],
  [/document\.documentElement\.dir\s*=\s*isRtlLocale/, 'localized html dir'],
  [/submitSettingsProfileRouteSurfaceData/, 'profile update submission'],
  [/<form\b/, 'editable profile form'],
  [/name=["']name["']/, 'profile name field'],
  [/name=["']image["']/, 'profile image field'],
]) {
  if (!contains(settingsProfileViewAbs, regex)) {
    fail(`${settingsProfileViewFile} must apply ${label}`);
  }
}
if (
  contains(
    settingsProfileViewAbs,
    /href=\{\s*(?:data\.page\.)?profile\.image\s*\}/
  )
) {
  fail(`${settingsProfileViewFile} must not render raw profile image as href`);
}

if (
  !existsSync(
    join(root, 'src/app/[locale]/(landing)/settings/profile/page.tsx')
  )
) {
  fail(
    'src/app/[locale]/(landing)/settings/profile/page.tsx must remain until the legacy app route is retired'
  );
}

const settingsSecurityRouteFiles = [
  {
    file: 'apps/web/src/routes/settings/security.tsx',
    routeId: '/settings/security',
    localePattern: /defaultLocale/,
  },
  {
    file: 'apps/web/src/routes/$locale/settings/security.tsx',
    routeId: '/$locale/settings/security',
    localePattern: /params\.locale/,
  },
];

for (const { file, routeId, localePattern } of settingsSecurityRouteFiles) {
  const abs = join(root, file);
  if (!existsSync(abs)) {
    fail(`${file} must exist for Gate 4-B.3 settings security route`);
  }
  if (!contains(abs, /createFileRoute/)) {
    fail(`${file} must use createFileRoute`);
  }
  if (
    !contains(abs, new RegExp(`createFileRoute\\('${escapeRegex(routeId)}'\\)`))
  ) {
    fail(`${file} must declare TanStack route ${routeId}`);
  }
  if (!contains(abs, /loadSettingsSecurityRouteSurfaceData/)) {
    fail(`${file} must load settings security route surface data`);
  }
  if (!contains(abs, /getSettingsSecurityRouteSurfaceHead/)) {
    fail(`${file} must use settings security route surface head`);
  }
  if (!contains(abs, /SettingsSecurityRouteView/)) {
    fail(`${file} must render SettingsSecurityRouteView`);
  }
  if (!contains(abs, localePattern)) {
    fail(`${file} must use the expected locale source`);
  }
}

for (const fullPath of ['/settings/security', '/$locale/settings/security']) {
  if (
    !contains(
      homeRouteTreeAbs,
      new RegExp(`fullPath:\\s*'${escapeRegex(fullPath)}'`)
    )
  ) {
    fail(
      `${homeRouteTreeFile} must include settings security fullPath ${fullPath}`
    );
  }
}

for (const file of [
  'apps/web/src/routes/settings.tsx',
  'apps/web/src/routes/$locale/settings.tsx',
]) {
  if (existsSync(join(root, file))) {
    fail(`${file} must not be introduced for the settings security leaf`);
  }
}

const settingsSecurityDataFile =
  'src/server/member/settings-security-route-data.ts';
const settingsSecurityDataAbs = join(root, settingsSecurityDataFile);
if (
  !contains(
    settingsSecurityDataAbs,
    /createServerFn\(\{\s*method:\s*['"]GET['"]/
  )
) {
  fail(
    `${settingsSecurityDataFile} must use createServerFn({ method: 'GET' })`
  );
}
if (
  !contains(
    settingsSecurityDataAbs,
    /await\s+import\(\s*['"].\/settings-security-route-resolver['"]\s*\)/
  )
) {
  fail(
    `${settingsSecurityDataFile} must dynamically import the settings security resolver`
  );
}

const settingsSecurityResolverFile =
  'src/server/member/settings-security-route-resolver.ts';
const settingsSecurityResolverAbs = join(root, settingsSecurityResolverFile);
for (const [regex, label] of [
  [/normalizeLocale/, 'locale normalization'],
  [/loadSettingsSecurityRouteMessages/, 'settings security message loader'],
  [/readSignedInUserIdentity|getSignedInUserIdentity/, 'signed-in user check'],
  [/viewer:\s*\{\s*signedIn/s, 'signed-in boolean route data'],
  [/noindex,nofollow/, 'member noindex robots head'],
]) {
  if (!contains(settingsSecurityResolverAbs, regex)) {
    fail(`${settingsSecurityResolverFile} must use ${label}`);
  }
}
for (const [regex, label] of [
  [/next\/headers/, 'next/headers import'],
  [/session\.server/, 'legacy Next session server'],
  [
    /ConsoleLayout|LandingLayout|PublicAppProvider|AuthSnapshotProvider/,
    'legacy member shell',
  ],
  [/next-intl/, 'next-intl import'],
  [/next\/navigation/, 'next/navigation import'],
  [/@\/app\/|src\/app\//, 'legacy app import'],
  [/@\/themes\//, '@/themes import'],
]) {
  if (contains(settingsSecurityResolverAbs, regex)) {
    fail(`${settingsSecurityResolverFile} must not depend on ${label}`);
  }
}

const settingsSecurityMessagesFile =
  'src/server/member/settings-security-route-messages.ts';
const settingsSecurityMessagesAbs = join(root, settingsSecurityMessagesFile);
for (const [regex, label] of [
  [/settings\/security/, 'settings/security messages'],
  [/settings\/sidebar/, 'settings/sidebar messages'],
  [
    /\?\s*\(mergeDeep\(baseSecurity/,
    'base fallback for missing security messages',
  ],
  [
    /\?\s*\(mergeDeep\(baseSidebar/,
    'base fallback for missing sidebar messages',
  ],
  [/mergeDeep/, 'key-level fallback merge'],
]) {
  if (!contains(settingsSecurityMessagesAbs, regex)) {
    fail(`${settingsSecurityMessagesFile} must implement ${label}`);
  }
}

const settingsSecuritySurfaceFiles = [
  ...walk(join(root, 'src/surfaces/member/settings-shell')),
  ...walk(join(root, 'src/surfaces/member/settings-security')),
]
  .filter((file) => /\.(ts|tsx)$/.test(file))
  .map((file) => normalizePath(relative(root, file)))
  .sort();
for (const file of settingsSecuritySurfaceFiles) {
  const abs = join(root, file);
  for (const [regex, label] of [
    [/\bfrom\s+['"]next(?:\/|['"])/, 'next runtime import'],
    [/^\s*import\s+['"]next(?:\/|['"])/m, 'next side-effect import'],
    [/from\s+['"]next-intl(?:\/|['"])/, 'next-intl import'],
    [/@\/infra\/platform\/i18n\/navigation/, 'Next i18n navigation import'],
    [/@\/app\/|src\/app\//, 'legacy app import'],
    [/@\/themes\//, '@/themes import'],
    [/^\s*import\s+['"]server-only['"]/m, 'server-only marker'],
    [/session\.server/, 'legacy Next session server'],
  ]) {
    if (contains(abs, regex)) {
      fail(`${file} must not depend on ${label}`);
    }
  }
}

const settingsSecurityViewFile =
  'src/surfaces/member/settings-security/settings-security.view.tsx';
const settingsSecurityViewAbs = join(root, settingsSecurityViewFile);
for (const [regex, label] of [
  [/document\.documentElement\.lang\s*=\s*data\.locale/, 'localized html lang'],
  [/document\.documentElement\.dir\s*=\s*isRtlLocale/, 'localized html dir'],
]) {
  if (!contains(settingsSecurityViewAbs, regex)) {
    fail(`${settingsSecurityViewFile} must apply ${label}`);
  }
}

if (
  !existsSync(
    join(root, 'src/app/[locale]/(landing)/settings/security/page.tsx')
  )
) {
  fail(
    'src/app/[locale]/(landing)/settings/security/page.tsx must remain until the legacy app route is retired'
  );
}

const settingsCreditsRouteFiles = [
  {
    file: 'apps/web/src/routes/settings/credits.tsx',
    routeId: '/settings/credits',
    localePattern: /defaultLocale/,
  },
  {
    file: 'apps/web/src/routes/$locale/settings/credits.tsx',
    routeId: '/$locale/settings/credits',
    localePattern: /params\.locale/,
  },
];

for (const { file, routeId, localePattern } of settingsCreditsRouteFiles) {
  const abs = join(root, file);
  if (!existsSync(abs)) {
    fail(`${file} must exist for Gate 4-B.3d settings credits route`);
  }
  if (!contains(abs, /createFileRoute/)) {
    fail(`${file} must use createFileRoute`);
  }
  if (
    !contains(abs, new RegExp(`createFileRoute\\('${escapeRegex(routeId)}'\\)`))
  ) {
    fail(`${file} must declare TanStack route ${routeId}`);
  }
  if (!contains(abs, /loadSettingsCreditsRouteSurfaceData/)) {
    fail(`${file} must load settings credits route surface data`);
  }
  if (!contains(abs, /getSettingsCreditsRouteSurfaceHead/)) {
    fail(`${file} must use settings credits route surface head`);
  }
  if (!contains(abs, /SettingsCreditsRouteView/)) {
    fail(`${file} must render SettingsCreditsRouteView`);
  }
  if (!contains(abs, localePattern)) {
    fail(`${file} must use the expected locale source`);
  }
}

for (const fullPath of ['/settings/credits', '/$locale/settings/credits']) {
  if (
    !contains(
      homeRouteTreeAbs,
      new RegExp(`fullPath:\\s*'${escapeRegex(fullPath)}'`)
    )
  ) {
    fail(
      `${homeRouteTreeFile} must include settings credits fullPath ${fullPath}`
    );
  }
}

const settingsCreditsDataFile =
  'src/server/member/settings-credits-route-data.ts';
const settingsCreditsDataAbs = join(root, settingsCreditsDataFile);
if (
  !contains(
    settingsCreditsDataAbs,
    /createServerFn\(\{\s*method:\s*['"]GET['"]/
  )
) {
  fail(`${settingsCreditsDataFile} must use createServerFn({ method: 'GET' })`);
}
if (
  !contains(
    settingsCreditsDataAbs,
    /await\s+import\(\s*['"].\/settings-credits-route-resolver['"]\s*\)/
  )
) {
  fail(
    `${settingsCreditsDataFile} must dynamically import the settings credits resolver`
  );
}

const settingsCreditsResolverFile =
  'src/server/member/settings-credits-route-resolver.ts';
const settingsCreditsResolverAbs = join(root, settingsCreditsResolverFile);
for (const [regex, label] of [
  [/normalizeLocale/, 'locale normalization'],
  [/loadSettingsCreditsRouteMessages/, 'settings credits message loader'],
  [/readSignedInUserIdentity|getSignedInUserIdentity/, 'signed-in user check'],
  [/listOwnCreditsUseCase/, 'credits ledger use case'],
  [/readAccountRemainingCreditsUseCase/, 'remaining credits use case'],
  [/ACCOUNT_CREDIT_TRANSACTION_TYPE/, 'credit transaction type contract'],
  [/viewer:\s*\{\s*signedIn/s, 'signed-in boolean route data'],
  [/remainingCredits/, 'remaining credits route data'],
  [/records/, 'serializable credit records'],
  [/toISOString/, 'Date to string conversion'],
  [/JSON\.stringify/, 'route data serializability guard'],
  [/noindex,nofollow/, 'member noindex robots head'],
]) {
  if (!contains(settingsCreditsResolverAbs, regex)) {
    fail(`${settingsCreditsResolverFile} must use ${label}`);
  }
}
for (const [regex, label] of [
  [/accountRuntimeDeps/, 'legacy account runtime deps'],
  [/TableCard/, 'legacy table card'],
  [/React callback columns|callback columns/, 'callback table columns'],
  [/next\/headers/, 'next/headers import'],
  [/session\.server/, 'legacy Next session server'],
  [
    /ConsoleLayout|LandingLayout|PublicAppProvider|AuthSnapshotProvider/,
    'legacy member shell',
  ],
  [/next-intl/, 'next-intl import'],
  [/next\/navigation/, 'next/navigation import'],
  [/@\/app\/|src\/app\//, 'legacy app import'],
  [/@\/themes\//, '@/themes import'],
]) {
  if (contains(settingsCreditsResolverAbs, regex)) {
    fail(`${settingsCreditsResolverFile} must not depend on ${label}`);
  }
}

const settingsCreditsMessagesFile =
  'src/server/member/settings-credits-route-messages.ts';
const settingsCreditsMessagesAbs = join(root, settingsCreditsMessagesFile);
for (const [regex, label] of [
  [/settings\/credits/, 'settings/credits messages'],
  [/settings\/sidebar/, 'settings/sidebar messages'],
  [
    /\?\s*\(mergeDeep\(baseCredits/,
    'base fallback for missing credits messages',
  ],
  [
    /\?\s*\(mergeDeep\(baseSidebar/,
    'base fallback for missing sidebar messages',
  ],
  [/mergeDeep/, 'key-level fallback merge'],
]) {
  if (!contains(settingsCreditsMessagesAbs, regex)) {
    fail(`${settingsCreditsMessagesFile} must implement ${label}`);
  }
}

const settingsCreditsSurfaceFiles = walk(
  join(root, 'src/surfaces/member/settings-credits')
)
  .filter((file) => /\.(ts|tsx)$/.test(file))
  .map((file) => normalizePath(relative(root, file)))
  .sort();
for (const file of settingsCreditsSurfaceFiles) {
  const abs = join(root, file);
  for (const [regex, label] of [
    [/\bfrom\s+['"]next(?:\/|['"])/, 'next runtime import'],
    [/^\s*import\s+['"]next(?:\/|['"])/m, 'next side-effect import'],
    [/from\s+['"]next-intl(?:\/|['"])/, 'next-intl import'],
    [/@\/infra\/platform\/i18n\/navigation/, 'Next i18n navigation import'],
    [/@\/app\/|src\/app\//, 'legacy app import'],
    [/@\/themes\//, '@/themes import'],
    [/^\s*import\s+['"]server-only['"]/m, 'server-only marker'],
    [/session\.server/, 'legacy Next session server'],
    [/TableCard/, 'legacy table card'],
  ]) {
    if (contains(abs, regex)) {
      fail(`${file} must not depend on ${label}`);
    }
  }
}

const settingsCreditsViewFile =
  'src/surfaces/member/settings-credits/settings-credits.view.tsx';
const settingsCreditsViewAbs = join(root, settingsCreditsViewFile);
for (const [regex, label] of [
  [/document\.documentElement\.lang\s*=\s*data\.locale/, 'localized html lang'],
  [/document\.documentElement\.dir\s*=\s*isRtlLocale/, 'localized html dir'],
  [/data\.page\.remainingCredits/, 'remaining credits display'],
  [/data\.page\.records/, 'plain serializable records table'],
  [/data\.page\.tabs/, 'type filter tabs'],
]) {
  if (!contains(settingsCreditsViewAbs, regex)) {
    fail(`${settingsCreditsViewFile} must apply ${label}`);
  }
}

if (
  !existsSync(
    join(root, 'src/app/[locale]/(landing)/settings/credits/page.tsx')
  )
) {
  fail(
    'src/app/[locale]/(landing)/settings/credits/page.tsx must remain until the legacy app route is retired'
  );
}

const settingsBillingRouteFiles = [
  {
    file: 'apps/web/src/routes/settings/billing.tsx',
    routeId: '/settings/billing',
    localePattern: /defaultLocale/,
  },
  {
    file: 'apps/web/src/routes/$locale/settings/billing.tsx',
    routeId: '/$locale/settings/billing',
    localePattern: /params\.locale/,
  },
];

for (const { file, routeId, localePattern } of settingsBillingRouteFiles) {
  const abs = join(root, file);
  if (!existsSync(abs)) {
    fail(`${file} must exist for Gate 4-B.3e settings billing route`);
  }
  if (!contains(abs, /createFileRoute/)) {
    fail(`${file} must use createFileRoute`);
  }
  if (
    !contains(abs, new RegExp(`createFileRoute\\('${escapeRegex(routeId)}'\\)`))
  ) {
    fail(`${file} must declare TanStack route ${routeId}`);
  }
  if (!contains(abs, /loadSettingsBillingRouteSurfaceData/)) {
    fail(`${file} must load settings billing route surface data`);
  }
  if (!contains(abs, /getSettingsBillingRouteSurfaceHead/)) {
    fail(`${file} must use settings billing route surface head`);
  }
  if (!contains(abs, /SettingsBillingRouteView/)) {
    fail(`${file} must render SettingsBillingRouteView`);
  }
  if (!contains(abs, localePattern)) {
    fail(`${file} must use the expected locale source`);
  }
}

for (const fullPath of ['/settings/billing', '/$locale/settings/billing']) {
  if (
    !contains(
      homeRouteTreeAbs,
      new RegExp(`fullPath:\\s*'${escapeRegex(fullPath)}'`)
    )
  ) {
    fail(
      `${homeRouteTreeFile} must include settings billing fullPath ${fullPath}`
    );
  }
}

const settingsBillingDataFile =
  'src/server/member/settings-billing-route-data.ts';
const settingsBillingDataAbs = join(root, settingsBillingDataFile);
if (
  !contains(
    settingsBillingDataAbs,
    /createServerFn\(\{\s*method:\s*['"]GET['"]/
  )
) {
  fail(`${settingsBillingDataFile} must use createServerFn({ method: 'GET' })`);
}
if (
  !contains(
    settingsBillingDataAbs,
    /await\s+import\(\s*['"].\/settings-billing-route-resolver['"]\s*\)/
  )
) {
  fail(
    `${settingsBillingDataFile} must dynamically import the settings billing resolver`
  );
}

const settingsBillingResolverFile =
  'src/server/member/settings-billing-route-resolver.ts';
const settingsBillingResolverAbs = join(root, settingsBillingResolverFile);
for (const [regex, label] of [
  [/normalizeLocale/, 'locale normalization'],
  [/loadSettingsBillingRouteMessages/, 'settings billing message loader'],
  [/resolveSitePaymentCapability/, 'payment capability guard'],
  [/readSignedInUserIdentity|getSignedInUserIdentity/, 'signed-in user check'],
  [/readMemberBillingOverviewQuery/, 'member billing overview query'],
  [/currentSubscription/, 'current subscription route data'],
  [/manageHref/, 'current subscription manage link route data'],
  [/subscriptions|records/, 'subscription history route data'],
  [/cancelHref/, 'subscription cancel link route data'],
  [/status/, 'status query filter'],
  [/pageSize/, 'page size query filter'],
  [/orderNo/, 'payment callback display data'],
  [/JSON\.stringify/, 'route data serializability guard'],
  [/noindex,nofollow/, 'member noindex robots head'],
]) {
  if (!contains(settingsBillingResolverAbs, regex)) {
    fail(`${settingsBillingResolverFile} must use ${label}`);
  }
}
for (const [regex, label] of [
  [/cancelMemberSubscription/, 'subscription cancel action'],
  [/retrieveMemberBillingPortalUrl/, 'provider portal redirect'],
  [/retrieveBillingPortalUseCase/, 'billing portal use case'],
  [/confirmPaymentCallbackUseCase/, 'payment callback mutation'],
  [/PaymentCallbackHandler/, 'legacy payment callback handler'],
  [/TableCard/, 'legacy table card'],
  [/React callback columns|callback columns/, 'callback table columns'],
  [/next\/headers/, 'next/headers import'],
  [/session\.server/, 'legacy Next session server'],
  [
    /ConsoleLayout|LandingLayout|PublicAppProvider|AuthSnapshotProvider/,
    'legacy member shell',
  ],
  [/next-intl/, 'next-intl import'],
  [/next\/navigation/, 'next/navigation import'],
  [/@\/app\/|src\/app\//, 'legacy app import'],
  [/@\/themes\//, '@/themes import'],
  [/settings-runtime\.query/, 'runtime settings query import'],
]) {
  if (contains(settingsBillingResolverAbs, regex)) {
    fail(`${settingsBillingResolverFile} must not depend on ${label}`);
  }
}

const settingsBillingMessagesFile =
  'src/server/member/settings-billing-route-messages.ts';
const settingsBillingMessagesAbs = join(root, settingsBillingMessagesFile);
for (const [regex, label] of [
  [/settings\/billing/, 'settings/billing messages'],
  [/settings\/sidebar/, 'settings/sidebar messages'],
  [
    /\?\s*\(mergeDeep\(baseBilling/,
    'base fallback for missing billing messages',
  ],
  [
    /\?\s*\(mergeDeep\(baseSidebar/,
    'base fallback for missing sidebar messages',
  ],
  [/mergeDeep/, 'key-level fallback merge'],
]) {
  if (!contains(settingsBillingMessagesAbs, regex)) {
    fail(`${settingsBillingMessagesFile} must implement ${label}`);
  }
}

const settingsBillingSurfaceFiles = walk(
  join(root, 'src/surfaces/member/settings-billing')
)
  .filter((file) => /\.(ts|tsx)$/.test(file))
  .map((file) => normalizePath(relative(root, file)))
  .sort();
for (const file of settingsBillingSurfaceFiles) {
  const abs = join(root, file);
  for (const [regex, label] of [
    [/\bfrom\s+['"]next(?:\/|['"])/, 'next runtime import'],
    [/^\s*import\s+['"]next(?:\/|['"])/m, 'next side-effect import'],
    [/from\s+['"]next-intl(?:\/|['"])/, 'next-intl import'],
    [/@\/infra\/platform\/i18n\/navigation/, 'Next i18n navigation import'],
    [/@\/app\/|src\/app\//, 'legacy app import'],
    [/@\/themes\//, '@/themes import'],
    [/^\s*import\s+['"]server-only['"]/m, 'server-only marker'],
    [/session\.server/, 'legacy Next session server'],
    [/TableCard/, 'legacy table card'],
    [/PaymentCallbackHandler/, 'legacy payment callback handler'],
  ]) {
    if (contains(abs, regex)) {
      fail(`${file} must not depend on ${label}`);
    }
  }
}

const settingsBillingViewFile =
  'src/surfaces/member/settings-billing/settings-billing.view.tsx';
const settingsBillingViewAbs = join(root, settingsBillingViewFile);
for (const [regex, label] of [
  [/document\.documentElement\.lang\s*=\s*data\.locale/, 'localized html lang'],
  [/document\.documentElement\.dir\s*=\s*isRtlLocale/, 'localized html dir'],
  [/data\.page\.currentSubscription/, 'current subscription display'],
  [/data\.page\.records/, 'plain serializable subscription table'],
  [/data\.page\.tabs/, 'status filter tabs'],
  [/data\.page\.paymentCallback/, 'payment callback route data'],
  [/\/api\/payment\/callback/, 'payment callback confirmation API call'],
  [
    /window\.location\.replace/,
    'clean URL replace after callback confirmation',
  ],
  [/currentSubscription\??\.manageHref/, 'current subscription manage action'],
  [/record\.actions\.cancelHref/, 'subscription cancel row action'],
  [/data\.page\.labels\.action/, 'subscription action column'],
]) {
  if (!contains(settingsBillingViewAbs, regex)) {
    fail(`${settingsBillingViewFile} must apply ${label}`);
  }
}
for (const [regex, label] of [
  [/settings\/invoices\/retrieve/, 'invoice retrieval link'],
]) {
  if (contains(settingsBillingViewAbs, regex)) {
    fail(`${settingsBillingViewFile} must not render ${label}`);
  }
}

if (
  !existsSync(
    join(root, 'src/app/[locale]/(landing)/settings/billing/page.tsx')
  )
) {
  fail(
    'src/app/[locale]/(landing)/settings/billing/page.tsx must remain until the legacy app route is retired'
  );
}

const settingsPaymentsRouteFiles = [
  {
    file: 'apps/web/src/routes/settings/payments.tsx',
    routeId: '/settings/payments',
    localePattern: /defaultLocale/,
  },
  {
    file: 'apps/web/src/routes/$locale/settings/payments.tsx',
    routeId: '/$locale/settings/payments',
    localePattern: /params\.locale/,
  },
];

for (const { file, routeId, localePattern } of settingsPaymentsRouteFiles) {
  const abs = join(root, file);
  if (!existsSync(abs)) {
    fail(`${file} must exist for Gate 4-B.3f settings payments route`);
  }
  if (!contains(abs, /createFileRoute/)) {
    fail(`${file} must use createFileRoute`);
  }
  if (
    !contains(abs, new RegExp(`createFileRoute\\('${escapeRegex(routeId)}'\\)`))
  ) {
    fail(`${file} must declare TanStack route ${routeId}`);
  }
  if (!contains(abs, /loadSettingsPaymentsRouteSurfaceData/)) {
    fail(`${file} must load settings payments route surface data`);
  }
  if (!contains(abs, /getSettingsPaymentsRouteSurfaceHead/)) {
    fail(`${file} must use settings payments route surface head`);
  }
  if (!contains(abs, /SettingsPaymentsRouteView/)) {
    fail(`${file} must render SettingsPaymentsRouteView`);
  }
  if (!contains(abs, localePattern)) {
    fail(`${file} must use the expected locale source`);
  }
}

for (const fullPath of ['/settings/payments', '/$locale/settings/payments']) {
  if (
    !contains(
      homeRouteTreeAbs,
      new RegExp(`fullPath:\\s*'${escapeRegex(fullPath)}'`)
    )
  ) {
    fail(
      `${homeRouteTreeFile} must include settings payments fullPath ${fullPath}`
    );
  }
}

const settingsPaymentsDataFile =
  'src/server/member/settings-payments-route-data.ts';
const settingsPaymentsDataAbs = join(root, settingsPaymentsDataFile);
if (
  !contains(
    settingsPaymentsDataAbs,
    /createServerFn\(\{\s*method:\s*['"]GET['"]/
  )
) {
  fail(
    `${settingsPaymentsDataFile} must use createServerFn({ method: 'GET' })`
  );
}
if (
  !contains(
    settingsPaymentsDataAbs,
    /await\s+import\(\s*['"].\/settings-payments-route-resolver['"]\s*\)/
  )
) {
  fail(
    `${settingsPaymentsDataFile} must dynamically import the settings payments resolver`
  );
}

const settingsPaymentsResolverFile =
  'src/server/member/settings-payments-route-resolver.ts';
const settingsPaymentsResolverAbs = join(root, settingsPaymentsResolverFile);
for (const [regex, label] of [
  [/normalizeLocale/, 'locale normalization'],
  [/loadSettingsPaymentsRouteMessages/, 'settings payments message loader'],
  [/resolveSitePaymentCapability/, 'payment capability guard'],
  [/readSignedInUserIdentity|getSignedInUserIdentity/, 'signed-in user check'],
  [/listMemberPaymentsQuery/, 'member payments query'],
  [/PaymentType/, 'payment type query filter'],
  [/pageSize/, 'page size query filter'],
  [/orderNo/, 'order number query parsing'],
  [/invoiceHref/, 'invoice link route data'],
  [/invoiceExternal/, 'external invoice marker'],
  [/settings\/invoices\/retrieve/, 'invoice retrieval link'],
  [/JSON\.stringify/, 'route data serializability guard'],
  [/noindex,nofollow/, 'member noindex robots head'],
]) {
  if (!contains(settingsPaymentsResolverAbs, regex)) {
    fail(`${settingsPaymentsResolverFile} must use ${label}`);
  }
}
for (const [regex, label] of [
  [/cancelMemberSubscription/, 'subscription cancel action'],
  [/retrieveMemberBillingPortalUrl/, 'provider portal redirect'],
  [/retrieveBillingPortalUseCase/, 'billing portal use case'],
  [/retrieveMemberInvoiceUrl|retrieveInvoiceUseCase/, 'invoice provider call'],
  [/confirmPaymentCallbackUseCase/, 'payment callback mutation'],
  [/PaymentCallbackHandler/, 'legacy payment callback handler'],
  [/TableCard/, 'legacy table card'],
  [/React callback columns|callback columns/, 'callback table columns'],
  [/next\/headers/, 'next/headers import'],
  [/session\.server/, 'legacy Next session server'],
  [
    /ConsoleLayout|LandingLayout|PublicAppProvider|AuthSnapshotProvider/,
    'legacy member shell',
  ],
  [/next-intl/, 'next-intl import'],
  [/next\/navigation/, 'next/navigation import'],
  [/@\/app\/|src\/app\//, 'legacy app import'],
  [/@\/themes\//, '@/themes import'],
  [/settings-runtime\.query/, 'runtime settings query import'],
]) {
  if (contains(settingsPaymentsResolverAbs, regex)) {
    fail(`${settingsPaymentsResolverFile} must not depend on ${label}`);
  }
}

const settingsPaymentsMessagesFile =
  'src/server/member/settings-payments-route-messages.ts';
const settingsPaymentsMessagesAbs = join(root, settingsPaymentsMessagesFile);
for (const [regex, label] of [
  [/settings\/payments/, 'settings/payments messages'],
  [/settings\/sidebar/, 'settings/sidebar messages'],
  [
    /\?\s*\(mergeDeep\(basePayments/,
    'base fallback for missing payments messages',
  ],
  [
    /\?\s*\(mergeDeep\(baseSidebar/,
    'base fallback for missing sidebar messages',
  ],
  [/mergeDeep/, 'key-level fallback merge'],
]) {
  if (!contains(settingsPaymentsMessagesAbs, regex)) {
    fail(`${settingsPaymentsMessagesFile} must implement ${label}`);
  }
}

const settingsPaymentsSurfaceFiles = walk(
  join(root, 'src/surfaces/member/settings-payments')
)
  .filter((file) => /\.(ts|tsx)$/.test(file))
  .map((file) => normalizePath(relative(root, file)))
  .sort();
for (const file of settingsPaymentsSurfaceFiles) {
  const abs = join(root, file);
  for (const [regex, label] of [
    [/\bfrom\s+['"]next(?:\/|['"])/, 'next runtime import'],
    [/^\s*import\s+['"]next(?:\/|['"])/m, 'next side-effect import'],
    [/from\s+['"]next-intl(?:\/|['"])/, 'next-intl import'],
    [/@\/infra\/platform\/i18n\/navigation/, 'Next i18n navigation import'],
    [/@\/app\/|src\/app\//, 'legacy app import'],
    [/@\/themes\//, '@/themes import'],
    [/^\s*import\s+['"]server-only['"]/m, 'server-only marker'],
    [/session\.server/, 'legacy Next session server'],
    [/TableCard/, 'legacy table card'],
    [/PaymentCallbackHandler/, 'legacy payment callback handler'],
  ]) {
    if (contains(abs, regex)) {
      fail(`${file} must not depend on ${label}`);
    }
  }
}

const settingsPaymentsViewFile =
  'src/surfaces/member/settings-payments/settings-payments.view.tsx';
const settingsPaymentsViewAbs = join(root, settingsPaymentsViewFile);
for (const [regex, label] of [
  [/document\.documentElement\.lang\s*=\s*data\.locale/, 'localized html lang'],
  [/document\.documentElement\.dir\s*=\s*isRtlLocale/, 'localized html dir'],
  [/data\.page\.records/, 'plain serializable payments table'],
  [/data\.page\.tabs/, 'payment type filter tabs'],
  [/invoiceHref/, 'invoice link rendering'],
  [/data\.page\.paymentCallback/, 'payment callback route data'],
  [/\/api\/payment\/callback/, 'payment callback confirmation API call'],
  [
    /window\.location\.replace/,
    'clean URL replace after callback confirmation',
  ],
  [/callbackTitle/, 'payment callback display copy'],
]) {
  if (!contains(settingsPaymentsViewAbs, regex)) {
    fail(`${settingsPaymentsViewFile} must apply ${label}`);
  }
}
for (const [regex, label] of [
  [/settings\/billing\/cancel/, 'cancel action link'],
  [/settings\/billing\/retrieve/, 'provider portal link'],
]) {
  if (contains(settingsPaymentsViewAbs, regex)) {
    fail(`${settingsPaymentsViewFile} must not render ${label}`);
  }
}

if (
  !existsSync(
    join(root, 'src/app/[locale]/(landing)/settings/payments/page.tsx')
  )
) {
  fail(
    'src/app/[locale]/(landing)/settings/payments/page.tsx must remain until the legacy app route is retired'
  );
}

const settingsApiKeysRouteFiles = [
  {
    file: 'apps/web/src/routes/settings/apikeys.tsx',
    routeId: '/settings/apikeys',
    localePattern: /defaultLocale/,
  },
  {
    file: 'apps/web/src/routes/$locale/settings/apikeys.tsx',
    routeId: '/$locale/settings/apikeys',
    localePattern: /params\.locale/,
  },
];

for (const { file, routeId, localePattern } of settingsApiKeysRouteFiles) {
  const abs = join(root, file);
  if (!existsSync(abs)) {
    fail(`${file} must exist for Gate 4-B.3h-1 settings API keys route`);
  }
  if (!contains(abs, /createFileRoute/)) {
    fail(`${file} must use createFileRoute`);
  }
  if (
    !contains(abs, new RegExp(`createFileRoute\\('${escapeRegex(routeId)}'\\)`))
  ) {
    fail(`${file} must declare TanStack route ${routeId}`);
  }
  if (!contains(abs, /loadSettingsApiKeysRouteSurfaceData/)) {
    fail(`${file} must load settings API keys route surface data`);
  }
  if (!contains(abs, /getSettingsApiKeysRouteSurfaceHead/)) {
    fail(`${file} must use settings API keys route surface head`);
  }
  if (!contains(abs, /SettingsApiKeysRouteView/)) {
    fail(`${file} must render SettingsApiKeysRouteView`);
  }
  if (!contains(abs, localePattern)) {
    fail(`${file} must use the expected locale source`);
  }
}

for (const fullPath of ['/settings/apikeys', '/$locale/settings/apikeys']) {
  if (
    !contains(
      homeRouteTreeAbs,
      new RegExp(`fullPath:\\s*'${escapeRegex(fullPath)}'`)
    )
  ) {
    fail(
      `${homeRouteTreeFile} must include settings API keys fullPath ${fullPath}`
    );
  }
}

const settingsApiKeysDataFile =
  'src/server/member/settings-apikeys-route-data.ts';
const settingsApiKeysDataAbs = join(root, settingsApiKeysDataFile);
if (
  !contains(
    settingsApiKeysDataAbs,
    /createServerFn\(\{\s*method:\s*['"]GET['"]/
  )
) {
  fail(`${settingsApiKeysDataFile} must use createServerFn({ method: 'GET' })`);
}
if (
  !contains(
    settingsApiKeysDataAbs,
    /await\s+import\(\s*['"].\/settings-apikeys-route-resolver['"]\s*\)/
  )
) {
  fail(
    `${settingsApiKeysDataFile} must dynamically import the settings API keys resolver`
  );
}

const settingsApiKeysResolverFile =
  'src/server/member/settings-apikeys-route-resolver.ts';
const settingsApiKeysResolverAbs = join(root, settingsApiKeysResolverFile);
for (const [regex, label] of [
  [/normalizeLocale/, 'locale normalization'],
  [/loadSettingsApiKeysRouteMessages/, 'settings API keys message loader'],
  [/readSignedInUserIdentity|getSignedInUserIdentity/, 'signed-in user check'],
  [/listOwnApikeysUseCase/, 'API keys list use case'],
  [/getApikeys/, 'API keys list infra dependency'],
  [/getApikeysCount/, 'API keys count infra dependency'],
  [/pageSize/, 'page size query filter'],
  [/editHref/, 'API key edit link route data'],
  [/deleteHref/, 'API key delete link route data'],
  [/settings\/apikeys\/create/, 'API key create link'],
  [/JSON\.stringify/, 'route data serializability guard'],
  [/noindex,nofollow/, 'member noindex robots head'],
]) {
  if (!contains(settingsApiKeysResolverAbs, regex)) {
    fail(`${settingsApiKeysResolverFile} must use ${label}`);
  }
}
for (const [regex, label] of [
  [/renameOwnApikeyUseCase/, 'API key rename mutation'],
  [/deleteOwnApikeyUseCase/, 'API key delete mutation'],
  [/requireOwnedApikeyUseCase/, 'API key ownership mutation gate'],
  [/FormCard/, 'legacy form card'],
  [/TableCard/, 'legacy table card'],
  [/withAction/, 'legacy server action helper'],
  [/parseFormData/, 'legacy form parser'],
  [/next\/headers/, 'next/headers import'],
  [/session\.server/, 'legacy Next session server'],
  [
    /ConsoleLayout|LandingLayout|PublicAppProvider|AuthSnapshotProvider/,
    'legacy member shell',
  ],
  [/next-intl/, 'next-intl import'],
  [/next\/navigation/, 'next/navigation import'],
  [/@\/app\/|src\/app\//, 'legacy app import'],
  [/@\/themes\//, '@/themes import'],
]) {
  if (contains(settingsApiKeysResolverAbs, regex)) {
    fail(`${settingsApiKeysResolverFile} must not depend on ${label}`);
  }
}

const settingsApiKeysMessagesFile =
  'src/server/member/settings-apikeys-route-messages.ts';
const settingsApiKeysMessagesAbs = join(root, settingsApiKeysMessagesFile);
for (const [regex, label] of [
  [/settings\/apikeys/, 'settings/apikeys messages'],
  [/settings\/sidebar/, 'settings/sidebar messages'],
  [
    /\?\s*\(mergeDeep\(baseApiKeys/,
    'base fallback for missing API keys messages',
  ],
  [
    /\?\s*\(mergeDeep\(baseSidebar/,
    'base fallback for missing sidebar messages',
  ],
  [/mergeDeep/, 'key-level fallback merge'],
]) {
  if (!contains(settingsApiKeysMessagesAbs, regex)) {
    fail(`${settingsApiKeysMessagesFile} must implement ${label}`);
  }
}

const settingsApiKeysSurfaceFiles = walk(
  join(root, 'src/surfaces/member/settings-apikeys')
)
  .filter((file) => /\.(ts|tsx)$/.test(file))
  .map((file) => normalizePath(relative(root, file)))
  .sort();
for (const file of settingsApiKeysSurfaceFiles) {
  const abs = join(root, file);
  for (const [regex, label] of [
    [/\bfrom\s+['"]next(?:\/|['"])/, 'next runtime import'],
    [/^\s*import\s+['"]next(?:\/|['"])/m, 'next side-effect import'],
    [/from\s+['"]next-intl(?:\/|['"])/, 'next-intl import'],
    [/@\/infra\/platform\/i18n\/navigation/, 'Next i18n navigation import'],
    [/@\/app\/|src\/app\//, 'legacy app import'],
    [/@\/themes\//, '@/themes import'],
    [/^\s*import\s+['"]server-only['"]/m, 'server-only marker'],
    [/session\.server/, 'legacy Next session server'],
    [/TableCard/, 'legacy table card'],
    [/FormCard/, 'legacy form card'],
  ]) {
    if (contains(abs, regex)) {
      fail(`${file} must not depend on ${label}`);
    }
  }
}

const settingsApiKeysViewFile =
  'src/surfaces/member/settings-apikeys/settings-apikeys.view.tsx';
const settingsApiKeysViewAbs = join(root, settingsApiKeysViewFile);
for (const [regex, label] of [
  [/document\.documentElement\.lang\s*=\s*data\.locale/, 'localized html lang'],
  [/document\.documentElement\.dir\s*=\s*isRtlLocale/, 'localized html dir'],
  [/data\.page\.records/, 'plain serializable API keys table'],
  [/data\.page\.createHref/, 'API key create link rendering'],
  [/editHref/, 'API key edit link rendering'],
  [/deleteHref/, 'API key delete link rendering'],
]) {
  if (!contains(settingsApiKeysViewAbs, regex)) {
    fail(`${settingsApiKeysViewFile} must apply ${label}`);
  }
}

if (
  !existsSync(
    join(root, 'src/app/[locale]/(landing)/settings/apikeys/page.tsx')
  )
) {
  fail(
    'src/app/[locale]/(landing)/settings/apikeys/page.tsx must remain until the legacy app route is retired'
  );
}

const settingsApiKeysCreateRouteFiles = [
  {
    file: 'apps/web/src/routes/settings/apikeys_/create.tsx',
    routeId: '/settings/apikeys_/create',
    localePattern: /defaultLocale/,
  },
  {
    file: 'apps/web/src/routes/$locale/settings/apikeys_/create.tsx',
    routeId: '/$locale/settings/apikeys_/create',
    localePattern: /params\.locale/,
  },
];

for (const {
  file,
  routeId,
  localePattern,
} of settingsApiKeysCreateRouteFiles) {
  const abs = join(root, file);
  if (!existsSync(abs)) {
    fail(`${file} must exist for Gate 4-B.3h-2 settings API key create route`);
  }
  if (!contains(abs, /createFileRoute/)) {
    fail(`${file} must use createFileRoute`);
  }
  if (
    !contains(abs, new RegExp(`createFileRoute\\('${escapeRegex(routeId)}'\\)`))
  ) {
    fail(`${file} must declare TanStack route ${routeId}`);
  }
  if (!contains(abs, /loadSettingsApiKeysCreateRouteSurfaceData/)) {
    fail(`${file} must load settings API key create route surface data`);
  }
  if (!contains(abs, /getSettingsApiKeysCreateRouteSurfaceHead/)) {
    fail(`${file} must use settings API key create route surface head`);
  }
  if (!contains(abs, /SettingsApiKeysCreateRouteView/)) {
    fail(`${file} must render SettingsApiKeysCreateRouteView`);
  }
  if (!contains(abs, localePattern)) {
    fail(`${file} must use the expected locale source`);
  }
}

for (const fullPath of [
  '/settings/apikeys/create',
  '/$locale/settings/apikeys/create',
]) {
  if (
    !contains(
      homeRouteTreeAbs,
      new RegExp(`fullPath:\\s*'${escapeRegex(fullPath)}'`)
    )
  ) {
    fail(
      `${homeRouteTreeFile} must include settings API key create fullPath ${fullPath}`
    );
  }
}

const settingsApiKeysCreateDataFile =
  'src/server/member/settings-apikeys-create-route-data.ts';
const settingsApiKeysCreateDataAbs = join(root, settingsApiKeysCreateDataFile);
if (
  !contains(
    settingsApiKeysCreateDataAbs,
    /createServerFn\(\{\s*method:\s*['"]GET['"]/
  )
) {
  fail(
    `${settingsApiKeysCreateDataFile} must use createServerFn({ method: 'GET' })`
  );
}
if (
  !contains(
    settingsApiKeysCreateDataAbs,
    /await\s+import\(\s*['"].\/settings-apikeys-create-route-resolver['"]\s*\)/
  )
) {
  fail(
    `${settingsApiKeysCreateDataFile} must dynamically import the settings API key create resolver`
  );
}

const settingsApiKeysCreateResolverFile =
  'src/server/member/settings-apikeys-create-route-resolver.ts';
const settingsApiKeysCreateResolverAbs = join(
  root,
  settingsApiKeysCreateResolverFile
);
for (const [regex, label] of [
  [/normalizeLocale/, 'locale normalization'],
  [/loadSettingsApiKeysRouteMessages/, 'settings API keys message loader'],
  [/readSignedInUserIdentity|getSignedInUserIdentity/, 'signed-in user check'],
  [/settings\/apikeys\/create/, 'API key create canonical path'],
  [/settings\/apikeys/, 'API keys back link'],
  [/JSON\.stringify/, 'route data serializability guard'],
  [/noindex,nofollow/, 'member noindex robots head'],
]) {
  if (!contains(settingsApiKeysCreateResolverAbs, regex)) {
    fail(`${settingsApiKeysCreateResolverFile} must use ${label}`);
  }
}
for (const [regex, label] of [
  [/renameOwnApikeyUseCase/, 'API key rename mutation'],
  [/deleteOwnApikeyUseCase/, 'API key delete mutation'],
  [/FormCard/, 'legacy form card'],
  [/withAction/, 'legacy server action helper'],
  [/parseFormData/, 'legacy form parser'],
  [/next\/headers/, 'next/headers import'],
  [/session\.server/, 'legacy Next session server'],
  [
    /ConsoleLayout|LandingLayout|PublicAppProvider|AuthSnapshotProvider/,
    'legacy member shell',
  ],
  [/next-intl/, 'next-intl import'],
  [/next\/navigation/, 'next/navigation import'],
  [/@\/app\/|src\/app\//, 'legacy app import'],
  [/@\/themes\//, '@/themes import'],
]) {
  if (contains(settingsApiKeysCreateResolverAbs, regex)) {
    fail(`${settingsApiKeysCreateResolverFile} must not depend on ${label}`);
  }
}

if (
  !contains(
    settingsApiKeysCreateDataAbs,
    /createServerFn\(\{\s*method:\s*['"]POST['"]/
  )
) {
  fail(
    `${settingsApiKeysCreateDataFile} must expose createServerFn({ method: 'POST' }) for API key create`
  );
}
if (
  !contains(settingsApiKeysCreateDataAbs, /submitSettingsApiKeyCreateRouteData/)
) {
  fail(
    `${settingsApiKeysCreateDataFile} must expose API key create submit data`
  );
}
for (const [regex, label] of [
  [/resolveSettingsApiKeyCreate/, 'API key create resolver'],
  [/createOwnApikeyUseCase/, 'API key create use case'],
  [/createApikey/, 'API key create infra dependency'],
  [/createSecretKey/, 'API key secret creation dependency'],
  [/getNonceStr/, 'API key secret generation'],
  [/getUuid/, 'API key id generation'],
  [/title is required/, 'API key title validation'],
]) {
  if (!contains(settingsApiKeysCreateResolverAbs, regex)) {
    fail(`${settingsApiKeysCreateResolverFile} must use ${label}`);
  }
}

const settingsApiKeysCreateSurfaceFiles = walk(
  join(root, 'src/surfaces/member/settings-apikeys-create')
)
  .filter((file) => /\.(ts|tsx)$/.test(file))
  .map((file) => normalizePath(relative(root, file)))
  .sort();
for (const file of settingsApiKeysCreateSurfaceFiles) {
  const abs = join(root, file);
  for (const [regex, label] of [
    [/\bfrom\s+['"]next(?:\/|['"])/, 'next runtime import'],
    [/^\s*import\s+['"]next(?:\/|['"])/m, 'next side-effect import'],
    [/from\s+['"]next-intl(?:\/|['"])/, 'next-intl import'],
    [/@\/infra\/platform\/i18n\/navigation/, 'Next i18n navigation import'],
    [/@\/app\/|src\/app\//, 'legacy app import'],
    [/@\/themes\//, '@/themes import'],
    [/^\s*import\s+['"]server-only['"]/m, 'server-only marker'],
    [/session\.server/, 'legacy Next session server'],
    [/FormCard/, 'legacy form card'],
  ]) {
    if (contains(abs, regex)) {
      fail(`${file} must not depend on ${label}`);
    }
  }
}

const settingsApiKeysCreateViewFile =
  'src/surfaces/member/settings-apikeys-create/settings-apikeys-create.view.tsx';
const settingsApiKeysCreateViewAbs = join(root, settingsApiKeysCreateViewFile);
for (const [regex, label] of [
  [/document\.documentElement\.lang\s*=\s*data\.locale/, 'localized html lang'],
  [/document\.documentElement\.dir\s*=\s*isRtlLocale/, 'localized html dir'],
  [/submitSettingsApiKeyCreateRouteSurfaceData/, 'API key create submit call'],
  [/window\.location\.assign/, 'success redirect handling'],
  [/name="title"/, 'API key title input'],
]) {
  if (!contains(settingsApiKeysCreateViewAbs, regex)) {
    fail(`${settingsApiKeysCreateViewFile} must apply ${label}`);
  }
}

if (
  !existsSync(
    join(root, 'src/app/[locale]/(landing)/settings/apikeys/create/page.tsx')
  )
) {
  fail(
    'src/app/[locale]/(landing)/settings/apikeys/create/page.tsx must remain until the legacy app route is retired'
  );
}

const settingsApiKeysIdRouteFiles = [
  {
    file: 'apps/web/src/routes/settings/apikeys_/$id/edit.tsx',
    routeId: '/settings/apikeys_/$id/edit',
    mode: 'edit',
    localePattern: /defaultLocale/,
  },
  {
    file: 'apps/web/src/routes/settings/apikeys_/$id/delete.tsx',
    routeId: '/settings/apikeys_/$id/delete',
    mode: 'delete',
    localePattern: /defaultLocale/,
  },
  {
    file: 'apps/web/src/routes/$locale/settings/apikeys_/$id/edit.tsx',
    routeId: '/$locale/settings/apikeys_/$id/edit',
    mode: 'edit',
    localePattern: /params\.locale/,
  },
  {
    file: 'apps/web/src/routes/$locale/settings/apikeys_/$id/delete.tsx',
    routeId: '/$locale/settings/apikeys_/$id/delete',
    mode: 'delete',
    localePattern: /params\.locale/,
  },
];

for (const {
  file,
  routeId,
  mode,
  localePattern,
} of settingsApiKeysIdRouteFiles) {
  const abs = join(root, file);
  if (!existsSync(abs)) {
    fail(`${file} must exist for Gate 4-B.3h-3 settings API key id routes`);
  }
  if (!contains(abs, /createFileRoute/)) {
    fail(`${file} must use createFileRoute`);
  }
  if (
    !contains(abs, new RegExp(`createFileRoute\\('${escapeRegex(routeId)}'\\)`))
  ) {
    fail(`${file} must declare TanStack route ${routeId}`);
  }
  if (!contains(abs, /loadSettingsApiKeysIdRouteSurfaceData/)) {
    fail(`${file} must load settings API key id route surface data`);
  }
  if (!contains(abs, /getSettingsApiKeysIdRouteSurfaceHead/)) {
    fail(`${file} must use settings API key id route surface head`);
  }
  if (!contains(abs, /SettingsApiKeysIdRouteView/)) {
    fail(`${file} must render SettingsApiKeysIdRouteView`);
  }
  if (!contains(abs, new RegExp(`mode:\\s*['"]${mode}['"]`))) {
    fail(`${file} must pass mode ${mode}`);
  }
  if (!contains(abs, /id:\s*params\.id/)) {
    fail(`${file} must pass params.id`);
  }
  if (!contains(abs, localePattern)) {
    fail(`${file} must use the expected locale source`);
  }
}

for (const fullPath of [
  '/settings/apikeys/$id/edit',
  '/settings/apikeys/$id/delete',
  '/$locale/settings/apikeys/$id/edit',
  '/$locale/settings/apikeys/$id/delete',
]) {
  if (
    !contains(
      homeRouteTreeAbs,
      new RegExp(`fullPath:\\s*'${escapeRegex(fullPath)}'`)
    )
  ) {
    fail(
      `${homeRouteTreeFile} must include settings API key id fullPath ${fullPath}`
    );
  }
}

const settingsApiKeysIdDataFile =
  'src/server/member/settings-apikeys-id-route-data.ts';
const settingsApiKeysIdDataAbs = join(root, settingsApiKeysIdDataFile);
for (const [regex, label] of [
  [/createServerFn\(\{\s*method:\s*['"]GET['"]/, 'GET server fn'],
  [/createServerFn\(\{\s*method:\s*['"]POST['"]/, 'POST server fn'],
  [/submitSettingsApiKeyUpdateRouteData/, 'API key update submit data'],
  [/submitSettingsApiKeyDeleteRouteData/, 'API key delete submit data'],
  [
    /await\s+import\(\s*['"].\/settings-apikeys-id-route-resolver['"]\s*\)/,
    'dynamic resolver import',
  ],
]) {
  if (!contains(settingsApiKeysIdDataAbs, regex)) {
    fail(`${settingsApiKeysIdDataFile} must implement ${label}`);
  }
}

const settingsApiKeysIdResolverFile =
  'src/server/member/settings-apikeys-id-route-resolver.ts';
const settingsApiKeysIdResolverAbs = join(root, settingsApiKeysIdResolverFile);
for (const [regex, label] of [
  [/normalizeLocale/, 'locale normalization'],
  [/loadSettingsApiKeysRouteMessages/, 'settings API keys message loader'],
  [/readSignedInUserIdentity|getSignedInUserIdentity/, 'signed-in user check'],
  [/requireOwnedApikeyUseCase/, 'API key ownership gate'],
  [/renameOwnApikeyUseCase/, 'API key rename mutation'],
  [/deleteOwnApikeyUseCase/, 'API key delete mutation'],
  [/findApikeyById/, 'API key lookup dependency'],
  [/updateApikey/, 'API key update dependency'],
  [/deletedAt/, 'soft delete timestamp'],
  [/buildCanonicalPath/, 'dynamic API key canonical path'],
  [/settings\/apikeys/, 'API keys back link'],
  [/no permission/, 'ownership failure message'],
  [/title is required/, 'API key title validation'],
  [/JSON\.stringify/, 'route data serializability guard'],
  [/noindex,nofollow/, 'member noindex robots head'],
]) {
  if (!contains(settingsApiKeysIdResolverAbs, regex)) {
    fail(`${settingsApiKeysIdResolverFile} must use ${label}`);
  }
}
for (const [regex, label] of [
  [/createOwnApikeyUseCase/, 'API key create mutation'],
  [/accountRuntimeDeps/, 'legacy account runtime deps'],
  [/requireActionUser/, 'legacy action user guard'],
  [/FormCard/, 'legacy form card'],
  [/withAction/, 'legacy server action helper'],
  [/parseFormData/, 'legacy form parser'],
  [/next\/headers/, 'next/headers import'],
  [/session\.server/, 'legacy Next session server'],
  [
    /ConsoleLayout|LandingLayout|PublicAppProvider|AuthSnapshotProvider/,
    'legacy member shell',
  ],
  [/next-intl/, 'next-intl import'],
  [/next\/navigation/, 'next/navigation import'],
  [/@\/app\/|src\/app\//, 'legacy app import'],
  [/@\/themes\//, '@/themes import'],
]) {
  if (contains(settingsApiKeysIdResolverAbs, regex)) {
    fail(`${settingsApiKeysIdResolverFile} must not depend on ${label}`);
  }
}

const settingsApiKeysIdSurfaceFiles = walk(
  join(root, 'src/surfaces/member/settings-apikeys-id')
)
  .filter((file) => /\.(ts|tsx)$/.test(file))
  .map((file) => normalizePath(relative(root, file)))
  .sort();
for (const file of settingsApiKeysIdSurfaceFiles) {
  const abs = join(root, file);
  for (const [regex, label] of [
    [/\bfrom\s+['"]next(?:\/|['"])/, 'next runtime import'],
    [/^\s*import\s+['"]next(?:\/|['"])/m, 'next side-effect import'],
    [/from\s+['"]next-intl(?:\/|['"])/, 'next-intl import'],
    [/@\/infra\/platform\/i18n\/navigation/, 'Next i18n navigation import'],
    [/@\/app\/|src\/app\//, 'legacy app import'],
    [/@\/themes\//, '@/themes import'],
    [/^\s*import\s+['"]server-only['"]/m, 'server-only marker'],
    [/session\.server/, 'legacy Next session server'],
    [/FormCard/, 'legacy form card'],
  ]) {
    if (contains(abs, regex)) {
      fail(`${file} must not depend on ${label}`);
    }
  }
}

const settingsApiKeysIdViewFile =
  'src/surfaces/member/settings-apikeys-id/settings-apikeys-id.view.tsx';
const settingsApiKeysIdViewAbs = join(root, settingsApiKeysIdViewFile);
for (const [regex, label] of [
  [/document\.documentElement\.lang\s*=\s*data\.locale/, 'localized html lang'],
  [/document\.documentElement\.dir\s*=\s*isRtlLocale/, 'localized html dir'],
  [/submitSettingsApiKeyUpdateRouteSurfaceData/, 'API key update submit call'],
  [/submitSettingsApiKeyDeleteRouteSurfaceData/, 'API key delete submit call'],
  [/window\.location\.assign/, 'success redirect handling'],
  [/data\.page\.mode\s*===\s*['"]delete['"]/, 'delete mode rendering'],
  [/name="title"/, 'API key title input'],
  [/name="key"/, 'API key key confirmation input'],
]) {
  if (!contains(settingsApiKeysIdViewAbs, regex)) {
    fail(`${settingsApiKeysIdViewFile} must apply ${label}`);
  }
}

for (const legacyApiKeyFile of [
  'src/app/[locale]/(landing)/settings/apikeys/[id]/edit/page.tsx',
  'src/app/[locale]/(landing)/settings/apikeys/[id]/delete/page.tsx',
]) {
  if (!existsSync(join(root, legacyApiKeyFile))) {
    fail(
      `${legacyApiKeyFile} must remain until the legacy app route is retired`
    );
  }
}

const settingsBillingActionRouteFiles = [
  {
    file: 'apps/web/src/routes/settings/billing_/cancel.tsx',
    routeId: '/settings/billing_/cancel',
    loaderPattern: /loadSettingsBillingCancelRouteSurfaceData/,
    localePattern: /defaultLocale/,
  },
  {
    file: 'apps/web/src/routes/$locale/settings/billing_/cancel.tsx',
    routeId: '/$locale/settings/billing_/cancel',
    loaderPattern: /loadSettingsBillingCancelRouteSurfaceData/,
    localePattern: /params\.locale/,
  },
  {
    file: 'apps/web/src/routes/settings/billing_/retrieve.tsx',
    routeId: '/settings/billing_/retrieve',
    loaderPattern: /loadSettingsBillingPortalRouteSurfaceData/,
    localePattern: /defaultLocale/,
  },
  {
    file: 'apps/web/src/routes/$locale/settings/billing_/retrieve.tsx',
    routeId: '/$locale/settings/billing_/retrieve',
    loaderPattern: /loadSettingsBillingPortalRouteSurfaceData/,
    localePattern: /params\.locale/,
  },
  {
    file: 'apps/web/src/routes/settings/invoices/retrieve.tsx',
    routeId: '/settings/invoices/retrieve',
    loaderPattern: /loadSettingsInvoiceRetrieveRouteSurfaceData/,
    localePattern: /defaultLocale/,
  },
  {
    file: 'apps/web/src/routes/$locale/settings/invoices/retrieve.tsx',
    routeId: '/$locale/settings/invoices/retrieve',
    loaderPattern: /loadSettingsInvoiceRetrieveRouteSurfaceData/,
    localePattern: /params\.locale/,
  },
];

for (const {
  file,
  routeId,
  loaderPattern,
  localePattern,
} of settingsBillingActionRouteFiles) {
  const abs = join(root, file);
  if (!existsSync(abs)) {
    fail(`${file} must exist for Gate 4-B.3g billing action route`);
  }
  if (!contains(abs, /createFileRoute/)) {
    fail(`${file} must use createFileRoute`);
  }
  if (
    !contains(abs, new RegExp(`createFileRoute\\('${escapeRegex(routeId)}'\\)`))
  ) {
    fail(`${file} must declare TanStack route ${routeId}`);
  }
  if (!contains(abs, loaderPattern)) {
    fail(`${file} must load the expected billing action route data`);
  }
  if (!contains(abs, /getSettingsBillingActionRouteSurfaceHead/)) {
    fail(`${file} must use billing action route surface head`);
  }
  if (!contains(abs, /SettingsBillingActionRouteView/)) {
    fail(`${file} must render SettingsBillingActionRouteView`);
  }
  if (!contains(abs, /redirect\(\{\s*href:\s*data\.redirectHref\s*\}\)/)) {
    fail(`${file} must redirect from explicit redirectHref only`);
  }
  if (!contains(abs, localePattern)) {
    fail(`${file} must use the expected locale source`);
  }
}

for (const fullPath of [
  '/settings/billing/cancel',
  '/settings/billing/retrieve',
  '/settings/invoices/retrieve',
  '/$locale/settings/billing/cancel',
  '/$locale/settings/billing/retrieve',
  '/$locale/settings/invoices/retrieve',
]) {
  if (
    !contains(
      homeRouteTreeAbs,
      new RegExp(`fullPath:\\s*'${escapeRegex(fullPath)}'`)
    )
  ) {
    fail(
      `${homeRouteTreeFile} must include billing action fullPath ${fullPath}`
    );
  }
}

const settingsBillingActionDataFile =
  'src/server/member/settings-billing-action-route-data.ts';
const settingsBillingActionDataAbs = join(root, settingsBillingActionDataFile);
for (const [regex, label] of [
  [/createServerFn\(\{\s*method:\s*['"]GET['"]/, 'GET createServerFn loaders'],
  [
    /createServerFn\(\{\s*method:\s*['"]POST['"]/,
    'POST createServerFn submit action',
  ],
  [/loadSettingsBillingCancelRouteData/, 'settings billing cancel GET loader'],
  [/loadSettingsBillingPortalRouteData/, 'settings billing portal GET loader'],
  [/loadSettingsInvoiceRetrieveRouteData/, 'settings invoice GET loader'],
  [/submitSettingsBillingCancelRouteData/, 'settings billing cancel POST'],
  [
    /await\s+import\(\s*['"].\/settings-billing-action-route-resolver['"]\s*\)/,
    'dynamic billing action resolver import',
  ],
]) {
  if (!contains(settingsBillingActionDataAbs, regex)) {
    fail(`${settingsBillingActionDataFile} must implement ${label}`);
  }
}

const settingsBillingActionResolverFile =
  'src/server/member/settings-billing-action-route-resolver.ts';
const settingsBillingActionResolverAbs = join(
  root,
  settingsBillingActionResolverFile
);
for (const [regex, label] of [
  [/normalizeLocale/, 'locale normalization'],
  [/loadSettingsBillingRouteMessages/, 'settings billing message loader'],
  [/resolveSitePaymentCapability/, 'payment capability guard'],
  [/getSignedInUserIdentityFromRequest/, 'TanStack request auth reader'],
  [/readMemberCancelableSubscription/, 'cancel page precheck'],
  [/cancelMemberSubscription/, 'subscription cancel action'],
  [/retrieveMemberBillingPortalUrl/, 'provider portal retrieval'],
  [/retrieveMemberInvoiceUrl/, 'provider invoice retrieval'],
  [/buildCanonicalUrl\(billingPath,\s*locale\)/, 'same-origin return URL'],
  [/localePath\(billingPath,\s*locale\)/, 'same-origin cancel redirect'],
  [/subscriptionNo/, 'subscription number query validation'],
  [/orderNo/, 'order number query validation'],
  [/normalizeExternalRedirect/, 'external redirect URL validation'],
  [/JSON\.stringify/, 'route data serializability guard'],
  [/noindex,nofollow/, 'member noindex robots head'],
]) {
  if (!contains(settingsBillingActionResolverAbs, regex)) {
    fail(`${settingsBillingActionResolverFile} must use ${label}`);
  }
}
for (const [regex, label] of [
  [/next\/headers/, 'next/headers import'],
  [/session\.server/, 'legacy Next session server'],
  [/requireActionUser/, 'legacy action user guard'],
  [/parseFormData/, 'legacy form parser'],
  [/withAction/, 'legacy action wrapper'],
  [/ActionError/, 'legacy action error'],
  [/FormCard/, 'legacy form card'],
  [/TableCard/, 'legacy table card'],
  [/PaymentCallbackHandler/, 'legacy payment callback handler'],
  [/next-intl/, 'next-intl import'],
  [/next\/navigation/, 'next/navigation import'],
  [/@\/app\/|src\/app\//, 'legacy app import'],
  [/@\/themes\//, '@/themes import'],
]) {
  if (contains(settingsBillingActionResolverAbs, regex)) {
    fail(`${settingsBillingActionResolverFile} must not depend on ${label}`);
  }
}

const settingsBillingActionSurfaceFiles = walk(
  join(root, 'src/surfaces/member/settings-billing-action')
)
  .filter((file) => /\.(ts|tsx)$/.test(file))
  .map((file) => normalizePath(relative(root, file)))
  .sort();
for (const file of settingsBillingActionSurfaceFiles) {
  const abs = join(root, file);
  for (const [regex, label] of [
    [/\bfrom\s+['"]next(?:\/|['"])/, 'next runtime import'],
    [/^\s*import\s+['"]next(?:\/|['"])/m, 'next side-effect import'],
    [/from\s+['"]next-intl(?:\/|['"])/, 'next-intl import'],
    [/@\/infra\/platform\/i18n\/navigation/, 'Next i18n navigation import'],
    [/@\/app\/|src\/app\//, 'legacy app import'],
    [/@\/themes\//, '@/themes import'],
    [/^\s*import\s+['"]server-only['"]/m, 'server-only marker'],
    [/session\.server/, 'legacy Next session server'],
    [/FormCard/, 'legacy form card'],
    [/withAction/, 'legacy action wrapper'],
    [/parseFormData/, 'legacy form parser'],
    [/requireActionUser/, 'legacy action user guard'],
    [/ActionError/, 'legacy action error'],
    [/TableCard/, 'legacy table card'],
    [/PaymentCallbackHandler/, 'legacy payment callback handler'],
  ]) {
    if (contains(abs, regex)) {
      fail(`${file} must not depend on ${label}`);
    }
  }
}

const settingsBillingActionViewFile =
  'src/surfaces/member/settings-billing-action/settings-billing-action.view.tsx';
const settingsBillingActionViewAbs = join(root, settingsBillingActionViewFile);
for (const [regex, label] of [
  [/document\.documentElement\.lang\s*=\s*data\.locale/, 'localized html lang'],
  [/document\.documentElement\.dir\s*=\s*isRtlLocale/, 'localized html dir'],
  [
    /await\s+import\(\s*['"].\/settings-billing-action\.data['"]\s*\)/,
    'lazy submit action import',
  ],
  [/data\.page\.subscription/, 'cancel subscription display'],
  [/data\.page\.message/, 'error message display'],
  [
    /window\.location\.assign\(result\.redirectTo\)/,
    'explicit success redirect',
  ],
]) {
  if (!contains(settingsBillingActionViewAbs, regex)) {
    fail(`${settingsBillingActionViewFile} must apply ${label}`);
  }
}

for (const legacyBillingActionFile of [
  'src/app/[locale]/(landing)/settings/billing/cancel/page.tsx',
  'src/app/[locale]/(landing)/settings/billing/retrieve/page.tsx',
  'src/app/[locale]/(landing)/settings/invoices/retrieve/page.tsx',
]) {
  if (!existsSync(join(root, legacyBillingActionFile))) {
    fail(
      `${legacyBillingActionFile} must remain until the legacy app route is retired`
    );
  }
}

for (const legacyMemberFile of [
  'src/app/[locale]/(landing)/settings/page.tsx',
  'src/app/[locale]/(landing)/settings/layout.tsx',
  'src/app/[locale]/(landing)/activity/page.tsx',
  'src/app/[locale]/(landing)/activity/layout.tsx',
]) {
  if (!existsSync(join(root, legacyMemberFile))) {
    fail(`${legacyMemberFile} must remain until member leaves are migrated`);
  }
}

const homeRouteDataFile = 'src/server/landing/home-route-data.ts';
const homeRouteDataAbs = join(root, homeRouteDataFile);
if (
  !contains(
    homeRouteDataAbs,
    /await\s+import\(['"].\/home-route-resolver['"]\)/
  )
) {
  fail(`${homeRouteDataFile} must dynamically import the home resolver`);
}

const homeRouteResolverFile = 'src/server/landing/home-route-resolver.ts';
const homeRouteResolverAbs = join(root, homeRouteResolverFile);
for (const [regex, label] of [
  [/isPublishedLocaleForPath\(\s*['"]\/['"]/, 'home publish-locale gate'],
  [/readBuildPublicUiConfig/, 'build-safe public UI config'],
  [/readBuildAuthUiSettings/, 'build-safe auth UI settings'],
  [/readBuildBillingUiSettings/, 'build-safe billing UI settings'],
]) {
  if (!contains(homeRouteResolverAbs, regex)) {
    fail(`${homeRouteResolverFile} must use ${label}`);
  }
}
for (const [regex, label] of [
  [
    /@\/domains\/content\/infra|@\/infra\/adapters\/db/,
    'direct content DB access',
  ],
  [/next-intl/, 'next-intl import'],
  [/next\/navigation/, 'next/navigation import'],
]) {
  if (contains(homeRouteResolverAbs, regex)) {
    fail(`${homeRouteResolverFile} must not depend on ${label}`);
  }
}

const homeSeoFile = 'src/surfaces/landing/home/home.seo.ts';
const homeSeoAbs = join(root, homeSeoFile);
if (!contains(homeSeoAbs, /noindex,nofollow/)) {
  fail(`${homeSeoFile} must return noindex,nofollow for missing home data`);
}

const productHomeResolverFile = 'src/server/landing/product-home-route-data.ts';
const productHomeResolverAbs = join(root, productHomeResolverFile);
for (const [regex, label] of [
  [/resolveProductHomeRouteData/, 'product home route data resolver'],
  [/content\?\.\[locale\]/, 'strict localized product home content gate'],
  [/turnstileSiteKey/, 'serializable text-to-speech Turnstile site key'],
]) {
  if (!contains(productHomeResolverAbs, regex)) {
    fail(`${productHomeResolverFile} must include ${label}`);
  }
}
if (contains(productHomeResolverAbs, /\?\?\s*content\?\.en/)) {
  fail(`${productHomeResolverFile} must not fall back to English home content`);
}
for (const [regex, label] of [
  [/productLanding\.render/, 'productLanding.render()'],
  [/resolveProductHeaderFooter/, 'fallback product shell resolver'],
]) {
  if (contains(homeRouteResolverAbs, regex)) {
    fail(`${homeRouteResolverFile} must not use ${label}`);
  }
}

const homeViewFile = 'src/surfaces/landing/home/home.view.tsx';
const homeViewAbs = join(root, homeViewFile);
for (const [regex, label] of [
  [/from\s+['"]next(?:\/|['"])/, 'next import'],
  [/from\s+['"]next-intl(?:\/|['"])/, 'next-intl import'],
  [/@\/themes\//, '@/themes import'],
  [/@\/app\//, '@/app import'],
]) {
  if (contains(homeViewAbs, regex)) {
    fail(`${homeViewFile} must not depend on ${label}`);
  }
}

for (const file of [
  'src/surfaces/landing/home/product-home.view.tsx',
  'src/domains/remover/ui/remover-home.tsx',
  'src/domains/remover/ui/remover-canvas-editor.tsx',
  'src/domains/background-remover/ui/background-remover-home.tsx',
  'src/domains/text-to-speech-generator/ui/text-to-speech-home.tsx',
  'src/domains/text-to-speech-generator/ui/text-to-speech-workbench.tsx',
  'src/domains/mp4-compressor/ui/mp4-compressor-home.tsx',
]) {
  const abs = join(root, file);
  for (const [regex, label] of [
    [/from\s+['"]next(?:\/|['"])/, 'next import'],
    [/from\s+['"]next-intl(?:\/|['"])/, 'next-intl import'],
    [/@\/themes\//, '@/themes import'],
    [/@\/app\//, '@/app import'],
  ]) {
    if (contains(abs, regex)) {
      fail(`${file} must not depend on ${label}`);
    }
  }
}

for (const file of [
  'apps/web/src/routes/pricing.tsx',
  'apps/web/src/routes/$locale/pricing.tsx',
]) {
  const abs = join(root, file);
  if (!contains(abs, /throw\s+notFound\s*\(/)) {
    fail(`${file} must throw TanStack notFound() for missing route data`);
  }
  for (const surfaceFile of [
    'pricing.data',
    'pricing.seo',
    'pricing.view',
    'pricing.types',
  ]) {
    if (
      !contains(abs, new RegExp(`@/surfaces/landing/pricing/${surfaceFile}`))
    ) {
      fail(`${file} must use ${surfaceFile} surface helper`);
    }
  }
}

const slugRouteFile = 'apps/web/src/routes/$locale/$slug.tsx';
const slugRouteAbs = join(root, slugRouteFile);
if (!contains(slugRouteAbs, /throw\s+notFound\s*\(/)) {
  fail(
    `${slugRouteFile} must throw TanStack notFound() for missing route data`
  );
}
for (const surfaceFile of [
  'slug.data',
  'slug.seo',
  'slug.view',
  'slug.types',
]) {
  if (
    !contains(
      slugRouteAbs,
      new RegExp(`@/surfaces/landing/slug/${surfaceFile}`)
    )
  ) {
    fail(`${slugRouteFile} must use ${surfaceFile} surface helper`);
  }
}

const slugRouteResolverFile = 'src/server/landing/slug-route-resolver.ts';
const slugRouteResolverAbs = join(root, slugRouteResolverFile);
if (!contains(slugRouteResolverAbs, /getLocalPublicContentDocument/)) {
  fail(`${slugRouteResolverFile} must read from generated public content`);
}
if (contains(slugRouteResolverAbs, /public-content\.query|getDocsPage/)) {
  fail(
    `${slugRouteResolverFile} must not depend on legacy public-content query`
  );
}

const blogIndexRouteFiles = [
  'apps/web/src/routes/blog_.tsx',
  'apps/web/src/routes/$locale/blog_.tsx',
];
for (const blogIndexRouteFile of blogIndexRouteFiles) {
  const blogIndexRouteAbs = join(root, blogIndexRouteFile);
  if (!contains(blogIndexRouteAbs, /throw\s+notFound\s*\(/)) {
    fail(
      `${blogIndexRouteFile} must throw TanStack notFound() for missing route data`
    );
  }
  for (const surfaceFile of [
    'blog-index.data',
    'blog-index.seo',
    'blog-index.view',
    'blog-index.types',
  ]) {
    if (
      !contains(
        blogIndexRouteAbs,
        new RegExp(`@/surfaces/landing/blog-index/${surfaceFile}`)
      )
    ) {
      fail(`${blogIndexRouteFile} must use ${surfaceFile} surface helper`);
    }
  }
}

const defaultBlogIndexRouteFile = 'apps/web/src/routes/blog_.tsx';
const defaultBlogIndexRouteAbs = join(root, defaultBlogIndexRouteFile);
if (!contains(defaultBlogIndexRouteAbs, /defaultLocale/)) {
  fail(`${defaultBlogIndexRouteFile} must load the default-locale blog index`);
}

const localizedBlogIndexRouteFile = 'apps/web/src/routes/$locale/blog_.tsx';
const localizedBlogIndexRouteAbs = join(root, localizedBlogIndexRouteFile);
if (!contains(localizedBlogIndexRouteAbs, /params\.locale/)) {
  fail(`${localizedBlogIndexRouteFile} must load params.locale blog index`);
}

const blogIndexSeoFile = 'src/surfaces/landing/blog-index/blog-index.seo.ts';
const blogIndexSeoAbs = join(root, blogIndexSeoFile);
if (!contains(blogIndexSeoAbs, /noindex,nofollow/)) {
  fail(
    `${blogIndexSeoFile} must return noindex,nofollow for missing blog data`
  );
}

const blogIndexViewFile = 'src/surfaces/landing/blog-index/blog-index.view.tsx';
const blogIndexViewAbs = join(root, blogIndexViewFile);
for (const [regex, label] of [
  [/from\s+['"]next(?:\/|['"])/, 'next import'],
  [/from\s+['"]next-intl(?:\/|['"])/, 'next-intl import'],
  [/@\/themes\//, '@/themes import'],
  [/@\/app\//, '@/app import'],
]) {
  if (contains(blogIndexViewAbs, regex)) {
    fail(`${blogIndexViewFile} must not depend on ${label}`);
  }
}

const blogIndexRouteResolverFile =
  'src/server/landing/blog-index-route-resolver.ts';
const blogIndexRouteResolverAbs = join(root, blogIndexRouteResolverFile);
if (!contains(blogIndexRouteResolverAbs, /getBlogPostsAndCategories/)) {
  fail(
    `${blogIndexRouteResolverFile} must reuse getBlogPostsAndCategories route data semantics`
  );
}
if (contains(blogIndexRouteResolverAbs, /isPublishedLocaleForPath/)) {
  fail(
    `${blogIndexRouteResolverFile} must not gate blog index on the page manifest`
  );
}
if (!contains(blogIndexRouteResolverAbs, /capabilities\.blog/)) {
  fail(`${blogIndexRouteResolverFile} must preserve the blog capability gate`);
}
for (const [regex, label] of [
  [
    /@\/domains\/content\/infra|@\/infra\/adapters\/db/,
    'direct content DB access',
  ],
  [/next-intl/, 'next-intl import'],
  [/next\/navigation/, 'next/navigation import'],
]) {
  if (contains(blogIndexRouteResolverAbs, regex)) {
    fail(`${blogIndexRouteResolverFile} must not depend on ${label}`);
  }
}

const blogPostRouteFiles = [
  'apps/web/src/routes/blog/$slug.tsx',
  'apps/web/src/routes/$locale/blog/$slug.tsx',
];
for (const blogPostRouteFile of blogPostRouteFiles) {
  const blogPostRouteAbs = join(root, blogPostRouteFile);
  if (!contains(blogPostRouteAbs, /throw\s+notFound\s*\(/)) {
    fail(
      `${blogPostRouteFile} must throw TanStack notFound() for missing route data`
    );
  }
  for (const surfaceFile of [
    'blog-post.data',
    'blog-post.seo',
    'blog-post.view',
    'blog-post.types',
  ]) {
    if (
      !contains(
        blogPostRouteAbs,
        new RegExp(`@/surfaces/landing/blog-post/${surfaceFile}`)
      )
    ) {
      fail(`${blogPostRouteFile} must use ${surfaceFile} surface helper`);
    }
  }
}

const blogPostSeoFile = 'src/surfaces/landing/blog-post/blog-post.seo.ts';
const blogPostSeoAbs = join(root, blogPostSeoFile);
if (!contains(blogPostSeoAbs, /noindex,nofollow/)) {
  fail(`${blogPostSeoFile} must return noindex,nofollow for missing posts`);
}

const defaultBlogPostRouteFile = 'apps/web/src/routes/blog/$slug.tsx';
const defaultBlogPostRouteAbs = join(root, defaultBlogPostRouteFile);
if (!contains(defaultBlogPostRouteAbs, /defaultLocale/)) {
  fail(`${defaultBlogPostRouteFile} must load default-locale blog posts`);
}

const blogPostViewFile = 'src/surfaces/landing/blog-post/blog-post.view.tsx';
const blogPostViewAbs = join(root, blogPostViewFile);
if (!contains(blogPostViewAbs, /BlogPostAdZoneView/)) {
  fail(`${blogPostViewFile} must render blog post ad zones`);
}

const blogPostRouteResolverFile =
  'src/server/landing/blog-post-route-resolver.ts';
const blogPostRouteResolverAbs = join(root, blogPostRouteResolverFile);
if (!contains(blogPostRouteResolverAbs, /getBlogPost/)) {
  fail(
    `${blogPostRouteResolverFile} must reuse getBlogPost route data semantics`
  );
}
if (contains(blogPostRouteResolverAbs, /isPublishedLocaleForPath/)) {
  fail(
    `${blogPostRouteResolverFile} must not gate blog posts on the page manifest`
  );
}
if (!contains(blogPostRouteResolverAbs, /resolveBlogPostAdZones/)) {
  fail(`${blogPostRouteResolverFile} must resolve blog post ad zones`);
}
if (!contains(blogPostRouteResolverAbs, /site\.capabilities\.blog/)) {
  fail(`${blogPostRouteResolverFile} must guard disabled blog capability`);
}
for (const [regex, label] of [
  [/next-intl/, 'next-intl import'],
  [/next\/navigation/, 'next/navigation import'],
  [
    /@\/domains\/content\/infra|@\/infra\/adapters\/db/,
    'direct content DB access',
  ],
]) {
  if (contains(blogPostRouteResolverAbs, regex)) {
    fail(`${blogPostRouteResolverFile} must not depend on ${label}`);
  }
}

const blogCategoryRouteFiles = [
  'apps/web/src/routes/blog/category/$slug.tsx',
  'apps/web/src/routes/$locale/blog/category/$slug.tsx',
];
for (const blogCategoryRouteFile of blogCategoryRouteFiles) {
  const blogCategoryRouteAbs = join(root, blogCategoryRouteFile);
  if (!contains(blogCategoryRouteAbs, /throw\s+notFound\s*\(/)) {
    fail(
      `${blogCategoryRouteFile} must throw TanStack notFound() for missing route data`
    );
  }
  for (const surfaceFile of [
    'blog-category.data',
    'blog-category.seo',
    'blog-category.view',
    'blog-category.types',
  ]) {
    if (
      !contains(
        blogCategoryRouteAbs,
        new RegExp(`@/surfaces/landing/blog-category/${surfaceFile}`)
      )
    ) {
      fail(`${blogCategoryRouteFile} must use ${surfaceFile} surface helper`);
    }
  }
}

const blogCategorySeoFile =
  'src/surfaces/landing/blog-category/blog-category.seo.ts';
const blogCategorySeoAbs = join(root, blogCategorySeoFile);
if (!contains(blogCategorySeoAbs, /noindex,nofollow/)) {
  fail(
    `${blogCategorySeoFile} must return noindex,nofollow for missing categories`
  );
}

const defaultBlogCategoryRouteFile =
  'apps/web/src/routes/blog/category/$slug.tsx';
const defaultBlogCategoryRouteAbs = join(root, defaultBlogCategoryRouteFile);
if (!contains(defaultBlogCategoryRouteAbs, /defaultLocale/)) {
  fail(`${defaultBlogCategoryRouteFile} must load default-locale categories`);
}

const blogCategoryViewFile =
  'src/surfaces/landing/blog-category/blog-category.view.tsx';
const blogCategoryViewAbs = join(root, blogCategoryViewFile);
for (const [regex, label] of [
  [/from\s+['"]next(?:\/|['"])/, 'next import'],
  [/from\s+['"]next-intl(?:\/|['"])/, 'next-intl import'],
  [/@\/themes\//, '@/themes import'],
  [/@\/app\//, '@/app import'],
]) {
  if (contains(blogCategoryViewAbs, regex)) {
    fail(`${blogCategoryViewFile} must not depend on ${label}`);
  }
}

const blogCategoryRouteResolverFile =
  'src/server/landing/blog-category-route-resolver.ts';
const blogCategoryRouteResolverAbs = join(root, blogCategoryRouteResolverFile);
if (
  !contains(blogCategoryRouteResolverAbs, /getBlogCategoryPostsAndCategories/)
) {
  fail(
    `${blogCategoryRouteResolverFile} must reuse getBlogCategoryPostsAndCategories route data semantics`
  );
}
if (contains(blogCategoryRouteResolverAbs, /isPublishedLocaleForPath/)) {
  fail(
    `${blogCategoryRouteResolverFile} must not gate blog categories on the page manifest`
  );
}
if (!contains(blogCategoryRouteResolverAbs, /site\.capabilities\.blog/)) {
  fail(`${blogCategoryRouteResolverFile} must guard disabled blog capability`);
}
for (const [regex, label] of [
  [
    /@\/domains\/content\/infra|@\/infra\/adapters\/db/,
    'direct content DB access',
  ],
  [/next-intl/, 'next-intl import'],
  [/next\/navigation/, 'next/navigation import'],
]) {
  if (contains(blogCategoryRouteResolverAbs, regex)) {
    fail(`${blogCategoryRouteResolverFile} must not depend on ${label}`);
  }
}

const sharedRouteActionContracts = [
  {
    file: 'apps/web/src/routes/api/auth.ts',
    required: [
      [/handleAuthApiRequest/, 'handleAuthApiRequest'],
      [/@\/server\/api\/auth\/auth-action/, 'server auth action'],
      [/withTanStackCloudflareBindings/, 'TanStack binding scope'],
    ],
    forbidden: [
      [/@\/app\/api\//, '@/app/api import'],
      [/better-auth\/next-js/, 'Next Better Auth adapter'],
      [/getAuth\(/, 'auth instance creation'],
    ],
  },
  {
    file: 'apps/web/src/routes/api/auth/$.ts',
    required: [
      [/handleAuthApiRequest/, 'handleAuthApiRequest'],
      [/@\/server\/api\/auth\/auth-action/, 'server auth action'],
      [/withTanStackCloudflareBindings/, 'TanStack binding scope'],
    ],
    forbidden: [
      [/@\/app\/api\//, '@/app/api import'],
      [/better-auth\/next-js/, 'Next Better Auth adapter'],
      [/getAuth\(/, 'auth instance creation'],
    ],
  },
  {
    file: 'apps/web/src/routes/api/background-remover/remove.ts',
    required: [
      [/postBackgroundRemoverRemove/, 'postBackgroundRemoverRemove'],
      [
        /@\/server\/api\/background-remover\/routes/,
        'server background remover routes',
      ],
      [/withTanStackCloudflareBindings/, 'TanStack binding scope'],
    ],
    forbidden: [
      [/@\/app\/api\//, '@/app/api import'],
      [/next\/headers/, 'Next headers import'],
      [/removeImageBackground/, 'background remover flow assembly'],
    ],
  },
  {
    file: 'apps/web/src/routes/api/background-remover/result/$id.ts',
    required: [
      [/getBackgroundRemoverResult/, 'getBackgroundRemoverResult'],
      [
        /@\/server\/api\/background-remover\/routes/,
        'server background remover routes',
      ],
      [/withTanStackCloudflareBindings/, 'TanStack binding scope'],
    ],
    forbidden: [
      [/@\/app\/api\//, '@/app/api import'],
      [/next\/headers/, 'Next headers import'],
      [/readBackgroundRemoverResultFile/, 'background remover read assembly'],
    ],
  },
  {
    file: 'apps/web/src/routes/api/background-remover/download/$id.ts',
    required: [
      [/getBackgroundRemoverDownload/, 'getBackgroundRemoverDownload'],
      [
        /@\/server\/api\/background-remover\/routes/,
        'server background remover routes',
      ],
      [/withTanStackCloudflareBindings/, 'TanStack binding scope'],
    ],
    forbidden: [
      [/@\/app\/api\//, '@/app/api import'],
      [/next\/headers/, 'Next headers import'],
      [/readBackgroundRemoverResultFile/, 'background remover read assembly'],
    ],
  },
  {
    file: 'apps/web/src/routes/api/background-remover/cleanup.ts',
    required: [
      [/postBackgroundRemoverCleanup/, 'postBackgroundRemoverCleanup'],
      [
        /@\/server\/api\/background-remover\/routes/,
        'server background remover routes',
      ],
      [/withTanStackCloudflareBindings/, 'TanStack binding scope'],
    ],
    forbidden: [
      [/@\/app\/api\//, '@/app/api import'],
      [/next\/headers/, 'Next headers import'],
      [
        /cleanupExpiredBackgroundRemoverImages/,
        'background remover cleanup assembly',
      ],
    ],
  },
  {
    file: 'apps/web/src/routes/api/payment/callback.ts',
    required: [
      [/createPaymentCallbackPostAction/, 'createPaymentCallbackPostAction'],
      [/@\/server\/api\/payment\/callback-action/, 'server callback action'],
      [/readTanStackPaymentRuntimeBindings/, 'TanStack payment bindings'],
      [/withTanStackCloudflareBindings/, 'TanStack binding scope'],
    ],
    forbidden: [
      [/@\/app\/api\//, '@/app/api import'],
      [/confirmPaymentCallbackUseCase/, 'payment callback use case'],
      [/PaymentCallbackBodySchema/, 'callback body schema parsing'],
    ],
  },
  {
    file: 'apps/web/src/routes/api/payment/checkout.ts',
    required: [
      [/createPaymentCheckoutPostAction/, 'createPaymentCheckoutPostAction'],
      [/@\/server\/api\/payment\/checkout-action/, 'server checkout action'],
      [/readTanStackPaymentRuntimeBindings/, 'TanStack payment bindings'],
      [/withTanStackCloudflareBindings/, 'TanStack binding scope'],
    ],
    forbidden: [
      [/@\/app\/api\//, '@/app/api import'],
      [/findPricingItemByProductId/, 'pricing item lookup'],
      [/PaymentCheckoutBodySchema/, 'checkout body schema parsing'],
      [/BadRequestError|NotFoundError/, 'checkout HTTP error branching'],
    ],
  },
  {
    file: 'apps/web/src/routes/api/payment/notify.ts',
    required: [
      [/buildPaymentNotifyPostLogic/, 'buildPaymentNotifyPostLogic'],
      [/@\/server\/api\/payment\/notify-action/, 'server notify action'],
      [/readTanStackPaymentRuntimeBindings/, 'TanStack payment bindings'],
      [/withTanStackCloudflareBindings/, 'TanStack binding scope'],
    ],
    forbidden: [
      [/@\/app\/api\//, '@/app/api import'],
      [/handlePaymentNotifyRequest/, 'payment notify flow invocation'],
      [/PaymentNotifyFlowDeps/, 'payment notify flow deps assembly'],
      [/onProcessFailure/, 'payment notify process-failure handler assembly'],
    ],
  },
  {
    file: 'apps/web/src/routes/api/user/get-user-credits.ts',
    required: [
      [/createUserCreditsPostAction/, 'createUserCreditsPostAction'],
      [
        /@\/server\/api\/user\/get-user-credits-action/,
        'server user credits action',
      ],
      [/withTanStackCloudflareBindings/, 'TanStack binding scope'],
    ],
    forbidden: [
      [/@\/app\/api\//, '@/app/api import'],
      [/readAccountCreditsSummaryUseCase/, 'credits use-case invocation'],
      [/jsonOk/, 'credits HTTP response construction'],
    ],
  },
  {
    file: 'apps/web/src/routes/api/remover/upload.ts',
    required: [
      [/postRemoverUpload/, 'postRemoverUpload'],
      [/@\/server\/api\/remover\/routes/, 'server remover routes'],
      [/withTanStackCloudflareBindings/, 'TanStack binding scope'],
    ],
    forbidden: [
      [/@\/app\/api\//, '@/app/api import'],
      [/next\/headers/, 'Next headers import'],
      [/createRemoverUploadPostAction/, 'remover action assembly'],
    ],
  },
  {
    file: 'apps/web/src/routes/api/remover/jobs.ts',
    required: [
      [/postRemoverJobs/, 'postRemoverJobs'],
      [/@\/server\/api\/remover\/routes/, 'server remover routes'],
      [/withTanStackCloudflareBindings/, 'TanStack binding scope'],
    ],
    forbidden: [
      [/@\/app\/api\//, '@/app/api import'],
      [/next\/headers/, 'Next headers import'],
      [/createRemoverJobsPostAction/, 'remover action assembly'],
    ],
  },
  {
    file: 'apps/web/src/routes/api/remover/jobs/$id.ts',
    required: [
      [/getRemoverJob/, 'getRemoverJob'],
      [/@\/server\/api\/remover\/routes/, 'server remover routes'],
      [/withTanStackCloudflareBindings/, 'TanStack binding scope'],
    ],
    forbidden: [
      [/@\/app\/api\//, '@/app/api import'],
      [/next\/headers/, 'Next headers import'],
      [/createRemoverJobGetAction/, 'remover action assembly'],
    ],
  },
  {
    file: 'apps/web/src/routes/api/remover/download/low-res.ts',
    required: [
      [/getRemoverLowResDownload/, 'getRemoverLowResDownload'],
      [/postRemoverLowResDownload/, 'postRemoverLowResDownload'],
      [/@\/server\/api\/remover\/routes/, 'server remover routes'],
      [/withTanStackCloudflareBindings/, 'TanStack binding scope'],
    ],
    forbidden: [
      [/@\/app\/api\//, '@/app/api import'],
      [/next\/headers/, 'Next headers import'],
      [/createRemoverDownload/, 'remover action assembly'],
    ],
  },
  {
    file: 'apps/web/src/routes/api/remover/download/high-res.ts',
    required: [
      [/postRemoverHighResDownload/, 'postRemoverHighResDownload'],
      [/@\/server\/api\/remover\/routes/, 'server remover routes'],
      [/withTanStackCloudflareBindings/, 'TanStack binding scope'],
    ],
    forbidden: [
      [/@\/app\/api\//, '@/app/api import'],
      [/next\/headers/, 'Next headers import'],
      [/createRemoverDownload/, 'remover action assembly'],
    ],
  },
  {
    file: 'apps/web/src/routes/api/tts/history.ts',
    required: [
      [/getTextToSpeechHistory/, 'getTextToSpeechHistory'],
      [/@\/server\/api\/tts\/routes/, 'server TTS routes'],
      [/withTanStackCloudflareBindings/, 'TanStack binding scope'],
    ],
    forbidden: [
      [/@\/app\/api\//, '@/app/api import'],
      [/next\/headers/, 'Next headers import'],
      [/listTextToSpeechHistory/, 'TTS history flow assembly'],
    ],
  },
  {
    file: 'apps/web/src/routes/api/tts/quota.ts',
    required: [
      [/getTextToSpeechQuota/, 'getTextToSpeechQuota'],
      [/@\/server\/api\/tts\/routes/, 'server TTS routes'],
      [/withTanStackCloudflareBindings/, 'TanStack binding scope'],
    ],
    forbidden: [
      [/@\/app\/api\//, '@/app/api import'],
      [/next\/headers/, 'Next headers import'],
      [/resolveTextToSpeechQuotaSummary/, 'TTS quota flow assembly'],
    ],
  },
  {
    file: 'apps/web/src/routes/api/tts/generate.ts',
    required: [
      [/postTextToSpeechGenerate/, 'postTextToSpeechGenerate'],
      [/@\/server\/api\/tts\/routes/, 'server TTS routes'],
      [/withTanStackCloudflareBindings/, 'TanStack binding scope'],
    ],
    forbidden: [
      [/@\/app\/api\//, '@/app/api import'],
      [/next\/headers/, 'Next headers import'],
      [/createTextToSpeechGeneratePostAction/, 'TTS action assembly'],
    ],
  },
  {
    file: 'apps/web/src/routes/api/tts/download/$id.ts',
    required: [
      [/getTextToSpeechDownload/, 'getTextToSpeechDownload'],
      [/@\/server\/api\/tts\/routes/, 'server TTS routes'],
      [/withTanStackCloudflareBindings/, 'TanStack binding scope'],
      [
        /createFileRoute\('\/api\/tts\/download\/\$id'\)/,
        'dynamic download route',
      ],
    ],
    forbidden: [
      [/@\/app\/api\//, '@/app/api import'],
      [/next\/headers/, 'Next headers import'],
      [/params\s*:\s*Promise/, 'legacy params Promise'],
      [/resolveTextToSpeechDownload/, 'TTS download flow assembly'],
    ],
  },
];

for (const contract of sharedRouteActionContracts) {
  const abs = join(root, contract.file);
  for (const [regex, label] of contract.required) {
    if (!contains(abs, regex)) {
      fail(`${contract.file} must use shared route action: ${label}`);
    }
  }
  for (const [regex, label] of contract.forbidden) {
    if (contains(abs, regex)) {
      fail(`${contract.file} must not inline ${label}`);
    }
  }
}

const backgroundRemoverRoutesFile =
  'src/server/api/background-remover/routes.ts';
const backgroundRemoverRoutesAbs = join(root, backgroundRemoverRoutesFile);
for (const [regex, label] of [
  [/resolveBackgroundRemoverActor/, 'request actor resolver'],
  [/getCloudflareImagesBinding/, 'Cloudflare Images binding reader'],
  [/getStorageService/, 'storage service'],
  [/requireBackgroundRemoverSite/, 'site capability guard'],
  [/createBackgroundRemoverRoutes/, 'background remover route factory'],
]) {
  if (!contains(backgroundRemoverRoutesAbs, regex)) {
    fail(`${backgroundRemoverRoutesFile} must use ${label}`);
  }
}
for (const [regex, label] of [
  [/@\/app\/api\//, '@/app/api import'],
  [/next\/headers/, 'Next headers import'],
  [/from\s+['"]next\//, 'next import'],
]) {
  if (contains(backgroundRemoverRoutesAbs, regex)) {
    fail(`${backgroundRemoverRoutesFile} must not depend on ${label}`);
  }
}

const backgroundRemoverRoutesCoreFile =
  'src/server/api/background-remover/routes-core.ts';
const backgroundRemoverRoutesCoreAbs = join(
  root,
  backgroundRemoverRoutesCoreFile
);
for (const [regex, label] of [
  [/detectAllowedImageMime/, 'shared image MIME detector'],
  [/createBackgroundRemoverRoutes/, 'background remover route factory'],
  [/readUploadRequestInput/, 'upload request parsing'],
]) {
  if (!contains(backgroundRemoverRoutesCoreAbs, regex)) {
    fail(`${backgroundRemoverRoutesCoreFile} must use ${label}`);
  }
}
for (const [regex, label] of [
  [/@\/app\/api\//, '@/app/api import'],
  [/next\/headers/, 'Next headers import'],
  [/from\s+['"]next\//, 'next import'],
  [/^\s*import\s+['"]server-only['"]/m, 'server-only marker'],
]) {
  if (contains(backgroundRemoverRoutesCoreAbs, regex)) {
    fail(`${backgroundRemoverRoutesCoreFile} must not depend on ${label}`);
  }
}

const textToSpeechRoutesFile = 'src/server/api/tts/routes.ts';
const textToSpeechRoutesAbs = join(root, textToSpeechRoutesFile);
for (const [regex, label] of [
  [/resolveTextToSpeechActor/, 'request actor resolver'],
  [/createTextToSpeechRoutes/, 'text-to-speech route factory'],
  [
    /createCloudflareTextToSpeechProvider/,
    'Cloudflare text-to-speech provider',
  ],
  [/verifyTextToSpeechTurnstile/, 'Turnstile verification'],
  [/getStorageService/, 'storage service'],
  [/requireTextToSpeechGeneratorSite/, 'site capability guard'],
]) {
  if (!contains(textToSpeechRoutesAbs, regex)) {
    fail(`${textToSpeechRoutesFile} must use ${label}`);
  }
}
for (const [regex, label] of [
  [/@\/app\/api\//, '@/app/api import'],
  [/next\/headers/, 'Next headers import'],
  [/from\s+['"]next\//, 'next import'],
]) {
  if (contains(textToSpeechRoutesAbs, regex)) {
    fail(`${textToSpeechRoutesFile} must not depend on ${label}`);
  }
}

const textToSpeechRoutesCoreFile = 'src/server/api/tts/routes-core.ts';
const textToSpeechRoutesCoreAbs = join(root, textToSpeechRoutesCoreFile);
for (const [regex, label] of [
  [/createTextToSpeechRoutes/, 'text-to-speech route factory'],
  [/createTextToSpeechGeneratePostAction/, 'text-to-speech generate action'],
  [/resolveTextToSpeechDownload/, 'text-to-speech download resolver'],
]) {
  if (!contains(textToSpeechRoutesCoreAbs, regex)) {
    fail(`${textToSpeechRoutesCoreFile} must use ${label}`);
  }
}
for (const [regex, label] of [
  [/@\/app\/api\//, '@/app/api import'],
  [/next\/headers/, 'Next headers import'],
  [/from\s+['"]next\//, 'next import'],
  [/^\s*import\s+['"]server-only['"]/m, 'server-only marker'],
]) {
  if (contains(textToSpeechRoutesCoreAbs, regex)) {
    fail(`${textToSpeechRoutesCoreFile} must not depend on ${label}`);
  }
}

const tanstackBillingRuntimeFile = 'apps/web/src/server/billing-runtime.ts';
const tanstackBillingRuntimeAbs = join(root, tanstackBillingRuntimeFile);
for (const [regex, label] of [
  [/readTanStackCloudflareBindings/, 'TanStack binding reader'],
  [/HYPERDRIVE/, 'Hyperdrive binding fallback'],
  [/readConfigRowsWithDatabaseUrl/, 'direct config row reader'],
  [/readTanStackPaymentRuntimeBindings/, 'TanStack payment binding reader'],
  [/getPaymentRuntimeBindings\(\{\s*bindings:/, 'payment binding propagation'],
  [/getServerRuntimeEnv\(\{\s*bindings:/, 'runtime env binding propagation'],
]) {
  if (!contains(tanstackBillingRuntimeAbs, regex)) {
    fail(`${tanstackBillingRuntimeFile} must implement ${label}`);
  }
}

const tanstackCloudflareBindingsFile =
  'apps/web/src/server/cloudflare-bindings.ts';
const tanstackCloudflareBindingsAbs = join(
  root,
  tanstackCloudflareBindingsFile
);
for (const [regex, label] of [
  [/cloudflare:workers/, 'TanStack Cloudflare workers bindings import'],
  [/readTanStackCloudflareBindings/, 'TanStack binding reader'],
  [/runWithTanStackCloudflareBindings/, 'TanStack binding scope runner'],
  [/runWithCloudflareBindings/, 'runtime binding scope propagation'],
]) {
  if (!contains(tanstackCloudflareBindingsAbs, regex)) {
    fail(`${tanstackCloudflareBindingsFile} must implement ${label}`);
  }
}

const runtimeEnvFile = 'src/infra/runtime/env.server.ts';
const runtimeEnvAbs = join(root, runtimeEnvFile);
for (const [regex, label] of [
  [/AsyncLocalStorage/, 'request-scoped runtime binding store'],
  [/runWithCloudflareBindings/, 'request-scoped binding runner'],
  [/cloudflareBindingsStore\.getStore/, 'scoped binding read before OpenNext'],
]) {
  if (!contains(runtimeEnvAbs, regex)) {
    fail(`${runtimeEnvFile} must implement ${label}`);
  }
}

const pricingMessagesFile = 'src/server/pricing/pricing-page-messages.ts';
const pricingMessagesAbs = join(root, pricingMessagesFile);
if (
  contains(
    pricingMessagesAbs,
    /getScopedMessages|@\/infra\/platform\/i18n\/messages|next-intl/
  )
) {
  fail(`${pricingMessagesFile} must not use legacy next-intl message loaders`);
}
if (
  !contains(
    pricingMessagesAbs,
    /@\/config\/locale\/messages\/\$\{locale\}\/\$\{path\}\.json/
  )
) {
  fail(`${pricingMessagesFile} must load local JSON message modules directly`);
}

const publicContentManifestFile =
  'src/domains/content/application/public-content-manifest.ts';
const publicContentManifestAbs = join(root, publicContentManifestFile);
if (!contains(publicContentManifestAbs, /@\/public-content/)) {
  fail(
    `${publicContentManifestFile} must read the generated public content manifest`
  );
}

const localContentFile = 'src/domains/content/application/local-content.tsx';
const localContentAbs = join(root, localContentFile);
for (const [regex, label] of [
  [/@\/mdx-components/, 'MDX component import'],
  [/from\s+['"]react['"]/, 'React import'],
  [/from\s+['"]fumadocs/, 'Fumadocs import'],
  [/pagesSource|postsSource/, 'Fumadocs source usage'],
  [/body\s*:/, 'React body route data'],
]) {
  if (contains(localContentAbs, regex)) {
    fail(`${localContentFile} must not keep ${label}`);
  }
}

const generatedPublicContentFile = '.generated/public-content.ts';
const generatedPublicContentAbs = join(root, generatedPublicContentFile);
if (!existsSync(generatedPublicContentAbs)) {
  fail(`${generatedPublicContentFile} must be generated`);
} else {
  const generatedPublicContentSource = readFileSync(
    generatedPublicContentAbs,
    'utf8'
  );
  const expectedPublicContentSiteKey = process.env.SITE?.trim() || 'dev-local';
  const publicContentSiteKeyMatch = generatedPublicContentSource.match(
    /export const publicContentSiteKey = "([^"]+)"/
  );
  const publicContentArtifactVersionMatch = generatedPublicContentSource.match(
    /export const publicContentArtifactVersion = "([^"]+)"/
  );

  if (publicContentSiteKeyMatch?.[1] !== expectedPublicContentSiteKey) {
    fail(
      `${generatedPublicContentFile} must be generated for SITE=${expectedPublicContentSiteKey}`
    );
  }
  if (
    !publicContentArtifactVersionMatch ||
    !/^build-\d+-\d+$/.test(publicContentArtifactVersionMatch[1])
  ) {
    fail(
      `${generatedPublicContentFile} must include artifact version metadata`
    );
  }

  for (const [regex, label] of [
    [/from\s+['"]react['"]/, 'React import'],
    [/from\s+['"]fumadocs/, 'Fumadocs import'],
    [/@\/mdx-components/, 'MDX component import'],
    [/docs\.css/, 'docs CSS import'],
  ]) {
    if (regex.test(generatedPublicContentSource)) {
      fail(`${generatedPublicContentFile} must not contain ${label}`);
    }
  }
}

const pricingViewFile = 'src/domains/pricing/ui/pricing-slice-view.tsx';
const pricingViewAbs = join(root, pricingViewFile);
for (const [regex, label] of [
  [/data\.faq/, 'FAQ content'],
  [/data\.testimonials/, 'testimonials content'],
]) {
  if (!contains(pricingViewAbs, regex)) {
    fail(`${pricingViewFile} must render ${label}`);
  }
}

if (!process.exitCode) {
  console.log(
    'tanstack native validation passed for Gate 0-3, Gate 3.1, Gate 3.2, and Gate 4 foundation contracts.'
  );
}
