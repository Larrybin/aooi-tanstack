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

function extractRuntimeImportSpecifiers(source) {
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

  while ((match = dynamicImportRegex.exec(source))) {
    specifiers.push(match[1]);
  }

  return specifiers;
}

function localRuntimeClosure(entryFiles) {
  const visited = new Set();
  const stack = [...entryFiles];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || visited.has(current)) continue;
    visited.add(current);

    const source = readFileSync(current, 'utf8');
    for (const specifier of extractRuntimeImportSpecifiers(source)) {
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

const requiredFiles = [
  'apps/web/src/routes/__root.tsx',
  'apps/web/src/routeTree.gen.ts',
  'apps/web/src/routes/pricing.tsx',
  'apps/web/src/routes/$locale/pricing.tsx',
  'apps/web/src/routes/api/payment/checkout.ts',
  'apps/web/src/routes/api/payment/notify.ts',
  'apps/web/src/routes/api/user/get-user-credits.ts',
  'apps/web/src/server/api-context.ts',
  'src/server/api/payment/checkout-action.ts',
  'src/server/api/payment/notify-action.ts',
  'src/server/api/user/get-user-credits-action.ts',
  'src/shared/seo/canonical.ts',
  'src/shared/i18n/locale.ts',
  'src/domains/pricing/application/pricing-page.ts',
  'src/server/pricing/pricing-page-messages.ts',
  'src/server/pricing/pricing-route-data.ts',
  'src/surfaces/landing/pricing/pricing.data.ts',
  'src/surfaces/landing/pricing/pricing.seo.ts',
  'src/surfaces/landing/pricing/pricing.view.tsx',
  'src/surfaces/landing/pricing/pricing.types.ts',
  'src/surfaces/system/not-found/not-found.view.tsx',
  'scripts/tanstack-gate-4-plan.mjs',
  'docs/migration/gate-4-page-migration-plan.generated.md',
  'docs/migration/gate-1-3-tanstack-nativity-review.md',
  'docs/migration/gate-4-surface-taint-audit.md',
  'vite.config.mts',
  'tsconfig.tanstack.json',
];

for (const file of requiredFiles) {
  if (!existsSync(join(root, file))) {
    fail(`missing required file ${file}`);
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
      new RegExp(`fullPath:\\s*'${escapeRegex(routePath)}'`)
    )
  ) {
    fail(`routeTree.gen.ts missing fullPath type ${routePath}`);
  }
}

const tanstackClosureFiles = localRuntimeClosure(sourceFilesIn('apps/web/src'));
const tanstackForbiddenRuntimePatterns = [
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

for (const file of tanstackClosureFiles) {
  for (const [regex, label] of tanstackForbiddenRuntimePatterns) {
    if (contains(file, regex)) {
      fail(
        `${label} found in TanStack runtime closure: ${relative(root, file)}`
      );
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
  (file) => !file.includes('/api/') && file !== 'apps/web/src/routes/index.tsx'
);
const tanstackPageRouteClosureFiles = localRuntimeClosure(
  tanstackPageRouteFiles.map((file) => join(root, file))
);
const tanstackPageRuntimeForbiddenPatterns = [
  [/\bfrom\s+['"]next(?:\/|['"])/, 'next runtime import'],
  [/^\s*import\s+['"]next(?:\/|['"])/m, 'next side-effect import'],
  [/from\s+['"]next-intl\/server['"]/, 'next-intl/server import'],
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

for (const file of [
  'apps/web/src/routes/pricing.tsx',
  'apps/web/src/routes/$locale/pricing.tsx',
]) {
  const abs = join(root, file);
  if (!contains(abs, /notFound\(\)/)) {
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

const indexRouteFile = 'apps/web/src/routes/index.tsx';
const indexRouteAbs = join(root, indexRouteFile);
if (!contains(indexRouteAbs, /to:\s*['"]\/pricing['"]/)) {
  fail(`${indexRouteFile} must redirect to canonical /pricing`);
}
if (contains(indexRouteAbs, /\/\$locale\/pricing|params:\s*\{/)) {
  fail(
    `${indexRouteFile} must not redirect through the locale-prefixed pricing route`
  );
}

const pricingMessagesFile = 'src/server/pricing/pricing-page-messages.ts';
const pricingMessagesAbs = join(root, pricingMessagesFile);
if (!contains(pricingMessagesAbs, /getScopedMessages/)) {
  fail(`${pricingMessagesFile} must reuse getScopedMessages`);
}
for (const [regex, label] of [
  [/config\/locale\/messages\/\$\{locale\}/, 'direct locale message import'],
  [/mergeDeep/, 'custom message merge'],
]) {
  if (contains(pricingMessagesAbs, regex)) {
    fail(`${pricingMessagesFile} must not keep ${label}`);
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
