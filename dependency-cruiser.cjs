const { ARCHITECTURE_RULES } = require('./architecture-rules.cjs');

const PRODUCTION_RUNTIME_PATH = '^(?:apps/web/src/|src/|cloudflare/)';
const NON_PRODUCTION_SOURCE_PATH =
  '^(?:src/testing/|src/architecture-boundaries\\.test\\.ts$)|(?:^|/)[^/]+\\.(?:test|spec)\\.[cm]?[jt]sx?$';

function escapeRegex(value) {
  return value.replace(/[|\\{}()[\]^$+*?.]/g, '\\$&');
}

function toDirectoryPathPattern(directories) {
  return `^(?:${directories.map(escapeRegex).join('|')})(?:/|$)`;
}

function importPatternToSourcePathPattern(pattern) {
  return pattern
    .replace(/^\^@\//, '^src/')
    .replace(/\(\?:\/\|\$\)/g, '(?:/|\\.[^.]+$)')
    .replace(/\$$/, '(?:\\.[^.]+)?$');
}

function createPathRules({ baseName, fromPath, importPatterns }) {
  return importPatterns.map((pattern, index) => ({
    name: index === 0 ? baseName : `${baseName}-${index + 1}`,
    severity: 'error',
    from: { path: fromPath },
    to: {
      path: importPatternToSourcePathPattern(pattern),
    },
  }));
}

function createExactPathRules({ baseName, fromPath, targetPaths }) {
  return targetPaths.map((targetPath, index) => ({
    name: index === 0 ? baseName : `${baseName}-${index + 1}`,
    severity: 'error',
    from: { path: fromPath },
    to: {
      path: `^${escapeRegex(targetPath)}$`,
    },
  }));
}

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
      name: 'no-import-legacy-architecture-paths',
      severity: 'error',
      from: {},
      to: {
        path: toDirectoryPathPattern(
          ARCHITECTURE_RULES.legacyArchitectureDirectories
        ),
      },
    },
    {
      name: 'no-runtime-to-scripts-or-tests',
      severity: 'error',
      from: {
        path: PRODUCTION_RUNTIME_PATH,
        pathNot: NON_PRODUCTION_SOURCE_PATH,
      },
      to: { path: '^(scripts/|tests/)' },
    },
    {
      name: 'no-scripts-to-tests',
      severity: 'error',
      from: { path: '^scripts/' },
      to: { path: '^tests/' },
    },
    {
      name: 'no-runtime-to-sites',
      severity: 'error',
      from: {
        path: PRODUCTION_RUNTIME_PATH,
        pathNot: NON_PRODUCTION_SOURCE_PATH,
      },
      to: { path: '^sites/' },
    },
    {
      name: 'no-tanstack-routes-to-domain-infra-adapters-themes-or-testing',
      severity: 'error',
      from: { path: '^apps/web/src/routes/' },
      to: {
        path: '^src/(domains/[^/]+/infra|infra/adapters|themes|testing)/',
      },
    },
    {
      name: 'no-runtime-to-web-entry-layer',
      severity: 'error',
      from: { path: '^(src|cloudflare)/' },
      to: { path: '^apps/web/' },
    },
    {
      name: 'no-prod-to-testing',
      severity: 'error',
      from: {
        path: PRODUCTION_RUNTIME_PATH,
        pathNot: NON_PRODUCTION_SOURCE_PATH,
      },
      to: { path: '^src/testing/' },
    },
    {
      name: 'no-surfaces-to-infra-adapters',
      severity: 'error',
      from: { path: '^src/surfaces/' },
      to: { path: '^src/infra/adapters/' },
    },
    {
      name: 'no-domain-domain-to-app-surfaces-adapters-or-api-schemas',
      severity: 'error',
      from: { path: '^src/domains/[^/]+/domain/' },
      to: {
        path: '^src/(surfaces|infra/adapters|shared/schemas/api)/',
      },
    },
    {
      name: 'no-infra-to-app-surfaces-or-domain-application',
      severity: 'error',
      from: { path: '^src/infra/' },
      to: {
        path: '^src/(surfaces|domains/[^/]+/application)/',
        pathNot:
          '^src/domains/settings/application/(?:[^/]+\\.query|settings-store|settings-runtime\\.contracts)\\.ts$',
      },
    },
    {
      name: 'no-shared-to-domains-surfaces-or-infra',
      severity: 'error',
      from: {
        path: '^src/shared/',
        pathNot:
          '^src/shared/lib/(auth-session\\.server|config-consistency|runtime/env\\.server|i18n/scoped-intl-provider)\\.tsx?$|^src/shared/(blocks|components|contexts|hooks)/',
      },
      to: {
        path: '^src/(domains|surfaces|infra)/',
        pathNot:
          '^src/domains/settings/application/settings-runtime\\.contracts\\.ts$|^src/infra/runtime/env\\.server\\.ts$|^src/infra/platform/logging/',
      },
    },
    {
      name: 'no-shared-ui-to-business-domains-or-adapters',
      severity: 'error',
      from: { path: '^src/shared/(blocks|components|contexts|hooks)/' },
      to: {
        path: '^src/(domains|infra/adapters|surfaces)/',
        pathNot:
          '^src/domains/settings/application/settings-runtime\\.contracts\\.ts$',
      },
    },
    ...createPathRules({
      baseName: 'no-surfaces-admin-to-app-facades-domain-infra-or-adapters-3',
      fromPath: '^src/surfaces/admin/',
      importPatterns: ARCHITECTURE_RULES.surfacesAdminForbiddenImports,
    }),
  ],
  options: {
    doNotFollow: {
      path: 'node_modules|^apps/web/src/routeTree\\.gen\\.ts$',
    },
    exclude:
      '(^node_modules)|(^dist)|(^build)|(^output)|(^\\.tmp)|(^src/shared/types/cloudflare\\.d\\.ts$)',
    tsPreCompilationDeps: true,
    tsConfig: {
      fileName: 'tsconfig.json',
    },
    enhancedResolveOptions: {
      extensions: ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json'],
      conditionNames: ['import', 'require', 'node', 'default'],
      mainFields: ['types', 'typings', 'module', 'main'],
    },
  },
};
