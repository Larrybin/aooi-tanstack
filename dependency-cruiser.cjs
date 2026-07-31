const PRODUCTION = '^(?:apps/web/src/|src/(?!testing/)|cloudflare/)';
const TEST_FILE =
  '(?:^src/architecture-boundaries\\.test\\.ts$|(?:^|/)[^/]+\\.(?:test|spec)\\.[cm]?[jt]sx?$)';

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'production-does-not-import-tests-or-scripts',
      severity: 'error',
      from: { path: PRODUCTION, pathNot: TEST_FILE },
      to: { path: '^(?:src/testing/|tests/|scripts/)' },
    },
    {
      name: 'routes-stay-out-of-domain-infra',
      severity: 'error',
      from: { path: '^apps/web/src/routes/' },
      to: {
        path: '^src/(?:domains/[^/]+/infra|infra/adapters|themes|testing)/',
      },
    },
    {
      name: 'runtime-does-not-import-web-entry',
      severity: 'error',
      from: { path: '^(?:src|cloudflare)/', pathNot: TEST_FILE },
      to: { path: '^apps/web/' },
    },
    {
      name: 'surfaces-do-not-import-adapters',
      severity: 'error',
      from: { path: '^src/surfaces/' },
      to: { path: '^src/infra/adapters/' },
    },
    {
      name: 'domain-models-point-inward',
      severity: 'error',
      from: { path: '^src/domains/[^/]+/domain/' },
      to: { path: '^src/(?:surfaces|infra|testing)/' },
    },
    {
      name: 'infra-does-not-import-surfaces',
      severity: 'error',
      from: { path: '^src/infra/' },
      to: { path: '^src/surfaces/' },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules|^\\.generated/' },
    exclude:
      '(^node_modules)|(^dist)|(^build)|(^output)|(^\\.tmp)|(^src/shared/types/cloudflare\\.d\\.ts$)',
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.json' },
    enhancedResolveOptions: {
      extensions: ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json'],
      conditionNames: ['import', 'require', 'node', 'default'],
      mainFields: ['types', 'typings', 'module', 'main'],
    },
  },
};
