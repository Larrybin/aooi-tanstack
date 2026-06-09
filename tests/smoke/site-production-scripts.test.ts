import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildProductionCommandOriginalEnv,
  buildProductionDeploySettingsJson,
  buildProductionHyperdriveName,
  buildProductionResourceNames,
  buildProductionWorkerName,
  getMissingProductionReleaseEnvNames,
  hasUnsafeProductionReleaseTestDatabase,
  isProductionAuthRequired,
  isProductionHyperdrivePlaceholder,
  isProductionHyperdriveRequired,
  updateProductionDeploySettingsHyperdriveId,
  updateProductionDeploySettingsNames,
} from '../../scripts/site-production.mjs';
import siteEnvModule from '../../src/config/site-env.cjs';

const { applySiteLocalEnvOverlay } = siteEnvModule;

const baseSiteConfig = {
  capabilities: {
    ai: false,
    auth: true,
    blog: false,
    docs: false,
    payment: 'creem',
  },
  domain: 'example.com',
  key: 'background-remover',
};

const baseDeploySettings = {
  bindingRequirements: {
    bindings: {
      hyperdrive: true,
      workersAi: false,
    },
    secrets: {
      authSharedSecret: true,
      githubOauth: false,
      googleOauth: true,
      removerCleanup: true,
      turnstile: false,
    },
    vars: {
      storagePublicBaseUrl: true,
    },
  },
  configVersion: 1,
  resources: {
    appStorageBucket: 'aooi-background-remover-storage',
    hyperdriveId: '00000000000000000000000000000003',
    incrementalCacheBucket: 'aooi-background-remover-opennext-cache',
  },
  state: {
    schemaVersion: 1,
  },
  workers: {
    admin: 'aooi-background-remover-admin',
    auth: 'aooi-background-remover-auth',
    member: 'aooi-background-remover-member',
    payment: 'aooi-background-remover-payment',
    'public-web': 'aooi-background-remover-public-web',
    router: 'aooi-background-remover-router',
    state: 'aooi-background-remover-state',
  },
};

test('site production provision identifies only known placeholder Hyperdrive ids', () => {
  assert.equal(
    isProductionHyperdrivePlaceholder('00000000000000000000000000000000'),
    true
  );
  assert.equal(
    isProductionHyperdrivePlaceholder('00000000000000000000000000000003'),
    true
  );
  assert.equal(
    isProductionHyperdrivePlaceholder('0123456789abcdef0123456789abcdef'),
    false
  );
});

test('site production provision derives the production Hyperdrive name', () => {
  assert.equal(
    buildProductionHyperdriveName('background-remover'),
    'aooi-background-remover-db'
  );
});

test('site production init derives explicit worker and bucket names', () => {
  assert.equal(
    buildProductionWorkerName('background-remover', 'public-web'),
    'aooi-background-remover-public-web'
  );
  assert.deepEqual(buildProductionResourceNames('background-remover'), {
    appStorageBucket: 'aooi-background-remover-storage',
    incrementalCacheBucket: 'aooi-background-remover-opennext-cache',
  });
});

test('site production init rewrites names but preserves active slots and Hyperdrive', () => {
  const settings = {
    ...baseDeploySettings,
    resources: {
      ...baseDeploySettings.resources,
      appStorageBucket: 'legacy-storage',
      incrementalCacheBucket: 'legacy-cache',
    },
    workers: {
      router: 'legacy-router',
      state: 'legacy-state',
      'public-web': 'legacy-public-web',
    },
  };
  const updated = updateProductionDeploySettingsNames({
    deploySettings: settings,
    siteKey: 'background-remover',
  });

  assert.deepEqual(updated.workers, {
    router: 'aooi-background-remover-router',
    state: 'aooi-background-remover-state',
    'public-web': 'aooi-background-remover-public-web',
  });
  assert.equal(
    updated.resources.incrementalCacheBucket,
    'aooi-background-remover-opennext-cache'
  );
  assert.equal(
    updated.resources.appStorageBucket,
    'aooi-background-remover-storage'
  );
  assert.equal(updated.resources.hyperdriveId, settings.resources.hyperdriveId);
});

test('site production command env pins production profile over shell and site env values', () => {
  const originalEnv = buildProductionCommandOriginalEnv(
    {
      CF_DEPLOY_PROFILE: 'preview',
      SITE: 'background-remover',
    },
    'background-remover'
  );
  const env = { ...originalEnv };

  applySiteLocalEnvOverlay({
    env,
    originalEnv,
    rootDir: '/repo',
    siteKey: 'background-remover',
    readFileSyncImpl() {
      return `
CF_DEPLOY_PROFILE=preview
NODE_ENV=development
PREVIEW_DATABASE_URL=postgresql://preview-db
CF_WORKERS_DEV_SUBDOMAIN=aooi-preview
PRODUCTION_DATABASE_URL=postgresql://production-db
PRODUCTION_STORAGE_PUBLIC_BASE_URL=https://backgroundremover.example.com/assets/
`;
    },
  });

  assert.equal(env.CF_DEPLOY_PROFILE, 'production');
  assert.equal(env.NODE_ENV, 'production');
  assert.equal(env.DATABASE_URL, 'postgresql://production-db');
  assert.equal(
    env.STORAGE_PUBLIC_BASE_URL,
    'https://backgroundremover.example.com/assets/'
  );
});

test('site production provision updates only the Hyperdrive id', () => {
  const updated = updateProductionDeploySettingsHyperdriveId(
    baseDeploySettings,
    '0123456789abcdef0123456789abcdef'
  );

  assert.equal(
    updated.resources.hyperdriveId,
    '0123456789abcdef0123456789abcdef'
  );
  assert.equal(
    updated.resources.appStorageBucket,
    baseDeploySettings.resources.appStorageBucket
  );
  assert.equal(updated.workers.router, baseDeploySettings.workers.router);
});

test('site production helpers detect whether Hyperdrive is required', () => {
  assert.equal(isProductionHyperdriveRequired(baseDeploySettings), true);
  assert.equal(
    isProductionHyperdriveRequired({
      ...baseDeploySettings,
      bindingRequirements: {
        ...baseDeploySettings.bindingRequirements,
        bindings: {
          ...baseDeploySettings.bindingRequirements.bindings,
          hyperdrive: false,
        },
      },
    }),
    false
  );
});

test('site production helpers detect whether auth is required', () => {
  assert.equal(
    isProductionAuthRequired({
      deploySettings: baseDeploySettings,
      siteConfig: baseSiteConfig,
    }),
    true
  );
  assert.equal(
    isProductionAuthRequired({
      deploySettings: {
        ...baseDeploySettings,
        bindingRequirements: {
          ...baseDeploySettings.bindingRequirements,
          secrets: {
            ...baseDeploySettings.bindingRequirements.secrets,
            authSharedSecret: false,
          },
        },
      },
      siteConfig: {
        ...baseSiteConfig,
        capabilities: {
          ...baseSiteConfig.capabilities,
          auth: false,
        },
      },
    }),
    false
  );
});

test('site production provision writes deploy settings JSON with a real Hyperdrive id', () => {
  assert.equal(
    buildProductionDeploySettingsJson({
      deploySettings: baseDeploySettings,
      hyperdriveId: '0123456789abcdef0123456789abcdef',
      siteConfig: baseSiteConfig,
    }),
    `${JSON.stringify(
      {
        ...baseDeploySettings,
        resources: {
          ...baseDeploySettings.resources,
          hyperdriveId: '0123456789abcdef0123456789abcdef',
        },
      },
      null,
      2
    )}\n`
  );
  assert.throws(
    () =>
      updateProductionDeploySettingsHyperdriveId(
        baseDeploySettings,
        'replace_with_hyperdrive_id'
      ),
    /production Hyperdrive id/
  );
});

test('site production doctor reports missing release env without exposing values', () => {
  assert.deepEqual(
    getMissingProductionReleaseEnvNames({
      AUTH_SECRET: 'auth-secret',
      CLOUDFLARE_ACCOUNT_ID: 'account-id',
      CLOUDFLARE_API_TOKEN: 'api-token',
      DATABASE_PROVIDER: 'postgresql',
      PRODUCTION_DATABASE_URL: 'postgresql://production-db',
      RELEASE_TEST_DATABASE_URL: 'postgresql://release-test-db',
      RESEND_API_KEY: 'resend-key',
      STORAGE_PUBLIC_BASE_URL: 'https://assets.example.com/',
    }),
    []
  );

  assert.deepEqual(
    getMissingProductionReleaseEnvNames({
      DATABASE_PROVIDER: 'sqlite',
      PRODUCTION_DATABASE_URL: 'postgresql://production-db',
    }),
    [
      'DATABASE_PROVIDER',
      'RELEASE_TEST_DATABASE_URL',
      'STORAGE_PUBLIC_BASE_URL',
      'CLOUDFLARE_ACCOUNT_ID',
      'CLOUDFLARE_API_TOKEN',
      'RESEND_API_KEY',
      'BETTER_AUTH_SECRET or AUTH_SECRET',
    ]
  );
});

test('site production doctor does not require database env for Hyperdrive-free sites', () => {
  assert.deepEqual(
    getMissingProductionReleaseEnvNames(
      {
        AUTH_SECRET: 'auth-secret',
        CLOUDFLARE_ACCOUNT_ID: 'account-id',
        CLOUDFLARE_API_TOKEN: 'api-token',
        RESEND_API_KEY: 'resend-key',
        STORAGE_PUBLIC_BASE_URL: 'https://assets.example.com/',
      },
      { hyperdriveRequired: false }
    ),
    []
  );
});

test('site production doctor does not require auth env for auth-free sites', () => {
  assert.deepEqual(
    getMissingProductionReleaseEnvNames(
      {
        CLOUDFLARE_ACCOUNT_ID: 'account-id',
        CLOUDFLARE_API_TOKEN: 'api-token',
        DATABASE_PROVIDER: 'postgresql',
        PRODUCTION_DATABASE_URL: 'postgresql://production-db',
        RELEASE_TEST_DATABASE_URL: 'postgresql://release-test-db',
        STORAGE_PUBLIC_BASE_URL: 'https://assets.example.com/',
      },
      { authRequired: false }
    ),
    []
  );
});

test('site production doctor rejects release tests against production database', () => {
  assert.equal(
    hasUnsafeProductionReleaseTestDatabase({
      PRODUCTION_DATABASE_URL: 'postgresql://same-db',
      RELEASE_TEST_DATABASE_URL: 'postgresql://same-db',
    }),
    true
  );
  assert.equal(
    hasUnsafeProductionReleaseTestDatabase({
      PRODUCTION_DATABASE_URL: 'postgresql://production-db',
      RELEASE_TEST_DATABASE_URL: 'postgresql://release-test-db',
    }),
    false
  );
  assert.equal(
    hasUnsafeProductionReleaseTestDatabase(
      {
        PRODUCTION_DATABASE_URL: 'postgresql://same-db',
        RELEASE_TEST_DATABASE_URL: 'postgresql://same-db',
      },
      { hyperdriveRequired: false }
    ),
    false
  );
});
