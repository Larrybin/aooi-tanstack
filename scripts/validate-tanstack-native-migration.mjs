import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';

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
    .replace(/^index$/, '');

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
  'apps/web/src/routes/api/payment/checkout.ts',
  'apps/web/src/routes/api/payment/notify.ts',
  'apps/web/src/routes/api/user/get-user-credits.ts',
  'apps/web/src/routes/$locale/blog/category/$slug.tsx',
  'apps/web/src/server/api-context.ts',
  'src/server/api/payment/checkout-action.ts',
  'src/server/api/payment/notify-action.ts',
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
  'src/server/landing/slug-route-data.ts',
  'src/server/landing/slug-route-resolver.ts',
  'src/server/landing/blog-index-route-data.ts',
  'src/server/landing/blog-index-route-resolver.ts',
  'src/server/landing/blog-post-route-data.ts',
  'src/server/landing/blog-post-route-resolver.ts',
  'src/server/landing/blog-category-route-data.ts',
  'src/server/landing/blog-category-route-resolver.ts',
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
  'src/surfaces/system/not-found/not-found.view.tsx',
  'scripts/tanstack-gate-4-plan.mjs',
  'docs/migration/gate-4-page-migration-plan.generated.md',
  'docs/migration/gate-1-3-tanstack-nativity-review.md',
  'docs/migration/gate-4-surface-taint-audit.md',
  'docs/migration/gate-4-a-slug-verification.md',
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

try {
  execFileSync('node', ['scripts/tanstack-gate-4-plan.mjs', '--check'], {
    cwd: root,
    stdio: 'inherit',
  });
} catch {
  fail('Gate 4 generated page migration matrix is stale');
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
const surfaceHelperExemptPageRoutes = new Set([]);
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
  contains(rootRouteAbs, /NotFoundRoute|new\s+Response\(\s*['"]Not found['"]/)
) {
  fail(
    `${rootRouteFile} must use TanStack notFoundComponent, not legacy 404 handling`
  );
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
    file: 'apps/web/src/routes/api/payment/checkout.ts',
    required: [
      [/createPaymentCheckoutPostAction/, 'createPaymentCheckoutPostAction'],
      [/@\/server\/api\/payment\/checkout-action/, 'server checkout action'],
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
    ],
    forbidden: [
      [/@\/app\/api\//, '@/app/api import'],
      [/readAccountCreditsSummaryUseCase/, 'credits use-case invocation'],
      [/jsonOk/, 'credits HTTP response construction'],
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
