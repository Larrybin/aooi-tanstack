import assert from 'node:assert/strict';
import test from 'node:test';

import { readCurrentSiteConfig } from '../../scripts/lib/site-config.mjs';
import {
  getActiveAppWorkerSlots,
  readSiteDeploySettings,
  readSitePreviewDeploySettings,
  validateSiteDeploySettings,
  validateSitePreviewDeploySettings,
} from '../../scripts/lib/site-deploy-settings.mjs';

test('site deploy settings 读取当前闭合 manifest', () => {
  const settings = readSiteDeploySettings({
    rootDir: process.cwd(),
    siteKey: 'mamamiya',
  });

  assert.equal(settings.configVersion, 1);
  assert.equal(settings.bindingRequirements.bindings.workersAi, false);
  assert.equal(settings.bindingRequirements.secrets.authSharedSecret, true);
  assert.equal('emailProvider' in settings.bindingRequirements.secrets, false);
  assert.equal('openrouter' in settings.bindingRequirements.secrets, false);
  assert.equal(settings.bindingRequirements.secrets.googleOauth, false);
  assert.equal(settings.bindingRequirements.secrets.githubOauth, false);
  assert.equal(settings.bindingRequirements.secrets.removerCleanup, false);
  assert.equal(settings.bindingRequirements.secrets.turnstile, false);
  assert.equal(settings.workers.router, 'roller-rabbit');
  assert.equal(settings.workers.chat, 'roller-rabbit-chat');
  assert.equal(settings.state.schemaVersion, 1);
});

test('site deploy settings 允许缺少可选 chat worker', () => {
  const settings = readSiteDeploySettings({
    rootDir: process.cwd(),
    siteKey: 'ai-remover',
  });

  assert.equal(settings.workers.chat, undefined);
  assert.deepEqual(getActiveAppWorkerSlots(settings), [
    'router',
    'public-web',
    'auth',
    'payment',
    'member',
    'admin',
  ]);
});

test('site deploy settings 缺少 required worker 时失败', () => {
  const siteConfig = readCurrentSiteConfig({
    rootDir: process.cwd(),
    siteKey: 'mamamiya',
  });

  assert.throws(
    () =>
      validateSiteDeploySettings(
        {
          configVersion: 1,
          bindingRequirements: {
            bindings: {
              hyperdrive: true,
              workersAi: false,
            },
            secrets: {
              authSharedSecret: true,
              googleOauth: false,
              githubOauth: false,
              removerCleanup: false,
              turnstile: false,
            },
            vars: {
              storagePublicBaseUrl: true,
            },
          },
          workers: {
            router: 'worker-router',
            state: 'worker-state',
          },
          resources: {
            incrementalCacheBucket: 'bucket-a',
            appStorageBucket: 'bucket-b',
            hyperdriveId: 'd208cd72765b46a7b0849fc687e2fb61',
          },
          state: {
            schemaVersion: 1,
          },
        },
        { siteConfig }
      ),
    /missing required worker slot\(s\): public-web/i
  );
});

test('site deploy settings 拒绝未知 worker key', () => {
  const siteConfig = readCurrentSiteConfig({
    rootDir: process.cwd(),
    siteKey: 'mamamiya',
  });

  assert.throws(
    () =>
      validateSiteDeploySettings(
        {
          configVersion: 1,
          bindingRequirements: {
            bindings: {
              hyperdrive: true,
              workersAi: false,
            },
            secrets: {
              authSharedSecret: true,
              googleOauth: false,
              githubOauth: false,
              removerCleanup: false,
              turnstile: false,
            },
            vars: {
              storagePublicBaseUrl: true,
            },
          },
          workers: {
            router: 'worker-router',
            state: 'worker-state',
            'public-web': 'worker-public-web',
            search: 'worker-search',
          },
          resources: {
            incrementalCacheBucket: 'bucket-a',
            appStorageBucket: 'bucket-b',
            hyperdriveId: 'd208cd72765b46a7b0849fc687e2fb61',
          },
          state: {
            schemaVersion: 1,
          },
        },
        { siteConfig }
      ),
    /unknown worker slot\(s\): search/i
  );
});

test('site deploy settings 启用 admin 时必须启用 auth', () => {
  const siteConfig = readCurrentSiteConfig({
    rootDir: process.cwd(),
    siteKey: 'mamamiya',
  });

  assert.throws(
    () =>
      validateSiteDeploySettings(
        {
          configVersion: 1,
          bindingRequirements: {
            bindings: {
              hyperdrive: true,
              workersAi: false,
            },
            secrets: {
              authSharedSecret: true,
              googleOauth: false,
              githubOauth: false,
              removerCleanup: false,
              turnstile: false,
            },
            vars: {
              storagePublicBaseUrl: true,
            },
          },
          workers: {
            router: 'worker-router',
            state: 'worker-state',
            'public-web': 'worker-public-web',
            admin: 'worker-admin',
          },
          resources: {
            incrementalCacheBucket: 'bucket-a',
            appStorageBucket: 'bucket-b',
            hyperdriveId: 'd208cd72765b46a7b0849fc687e2fb61',
          },
          state: {
            schemaVersion: 1,
          },
        },
        { siteConfig }
      ),
    /workers\.admin requires auth worker slot/i
  );
});

test('site deploy settings 启用能力时必须启用对应 worker', () => {
  const baseSiteConfig = readCurrentSiteConfig({
    rootDir: process.cwd(),
    siteKey: 'mamamiya',
  });
  const settings = {
    configVersion: 1,
    bindingRequirements: {
      bindings: {
        hyperdrive: true,
        workersAi: false,
      },
      secrets: {
        authSharedSecret: true,
        googleOauth: false,
        githubOauth: false,
        removerCleanup: false,
        turnstile: false,
      },
      vars: {
        storagePublicBaseUrl: true,
      },
    },
    workers: {
      router: 'worker-router',
      state: 'worker-state',
      'public-web': 'worker-public-web',
    },
    resources: {
      incrementalCacheBucket: 'bucket-a',
      appStorageBucket: 'bucket-b',
      hyperdriveId: 'd208cd72765b46a7b0849fc687e2fb61',
    },
    state: {
      schemaVersion: 1,
    },
  };

  const cases = [
    {
      capabilities: { auth: true, payment: 'none', ai: false },
      expected: /auth \(site\.capabilities\.auth\)/i,
    },
    {
      capabilities: { auth: false, payment: 'creem', ai: false },
      expected: /payment \(site\.capabilities\.payment\)/i,
    },
    {
      capabilities: { auth: false, payment: 'none', ai: true },
      expected: /chat \(site\.capabilities\.ai\)/i,
    },
  ];

  for (const item of cases) {
    assert.throws(
      () =>
        validateSiteDeploySettings(settings, {
          siteConfig: {
            ...baseSiteConfig,
            capabilities: {
              ...baseSiteConfig.capabilities,
              ...item.capabilities,
            },
          },
        }),
      item.expected
    );
  }
});

test('site deploy preview settings 只接受 Hyperdrive overlay', () => {
  const settings = readSitePreviewDeploySettings({
    rootDir: process.cwd(),
    siteKey: 'ai-remover',
  });

  assert.equal(settings.configVersion, 1);
  assert.match(settings.resources.hyperdriveId, /^[0-9a-f]{32}$/u);
});

test('site deploy preview settings 拒绝非 Hyperdrive 字段', () => {
  assert.throws(
    () =>
      validateSitePreviewDeploySettings({
        configVersion: 1,
        resources: {
          hyperdriveId: '00000000000000000000000000000003',
          appStorageBucket: 'preview-storage',
        },
      }),
    /preview settings\.resources must contain exactly/i
  );
});

test('site deploy settings 拒绝未知嵌套字段', () => {
  const siteConfig = readCurrentSiteConfig({
    rootDir: process.cwd(),
    siteKey: 'mamamiya',
  });

  assert.throws(
    () =>
      validateSiteDeploySettings(
        {
          configVersion: 1,
          bindingRequirements: {
            bindings: {
              hyperdrive: true,
              workersAi: false,
            },
            secrets: {
              authSharedSecret: true,
              googleOauth: false,
              githubOauth: false,
              removerCleanup: false,
              turnstile: false,
              extraSecret: false,
            },
            vars: {
              storagePublicBaseUrl: true,
            },
          },
          workers: {
            router: 'worker-router',
            state: 'worker-state',
            'public-web': 'worker-public-web',
            auth: 'worker-auth',
            payment: 'worker-payment',
            member: 'worker-member',
            chat: 'worker-chat',
            admin: 'worker-admin',
          },
          resources: {
            incrementalCacheBucket: 'bucket-a',
            appStorageBucket: 'bucket-b',
            hyperdriveId: 'd208cd72765b46a7b0849fc687e2fb61',
          },
          state: {
            schemaVersion: 1,
          },
        },
        { siteConfig }
      ),
    /bindingRequirements\.secrets must contain exactly/i
  );
});

test('site deploy settings 不接受派生 secret requirement 双写字段', () => {
  const siteConfig = readCurrentSiteConfig({
    rootDir: process.cwd(),
    siteKey: 'mamamiya',
  });

  assert.throws(
    () =>
      validateSiteDeploySettings(
        {
          configVersion: 1,
          bindingRequirements: {
            bindings: {
              hyperdrive: true,
              workersAi: false,
            },
            secrets: {
              authSharedSecret: true,
              googleOauth: false,
              githubOauth: false,
              removerCleanup: false,
              turnstile: false,
              emailProvider: true,
              stripe: true,
              openrouter: false,
            },
            vars: {
              storagePublicBaseUrl: true,
            },
          },
          workers: {
            router: 'worker-router',
            state: 'worker-state',
            'public-web': 'worker-public-web',
            auth: 'worker-auth',
            payment: 'worker-payment',
            member: 'worker-member',
            chat: 'worker-chat',
            admin: 'worker-admin',
          },
          resources: {
            incrementalCacheBucket: 'bucket-a',
            appStorageBucket: 'bucket-b',
            hyperdriveId: 'd208cd72765b46a7b0849fc687e2fb61',
          },
          state: {
            schemaVersion: 1,
          },
        },
        { siteConfig }
      ),
    /bindingRequirements\.secrets must contain exactly/i
  );
});

test('site deploy settings allow site-specific capability-derived contract to stay closed', async () => {
  const baseSiteConfig = readCurrentSiteConfig({
    rootDir: process.cwd(),
    siteKey: 'mamamiya',
  });
  const siteConfig = {
    ...baseSiteConfig,
    key: 'demo-site',
    domain: 'demo.example.com',
    capabilities: {
      ...baseSiteConfig.capabilities,
      auth: true,
      ai: true,
    },
  };
  const settings = {
    configVersion: 1,
    bindingRequirements: {
      bindings: {
        hyperdrive: true,
        workersAi: false,
      },
      secrets: {
        authSharedSecret: true,
        googleOauth: false,
        githubOauth: false,
        removerCleanup: false,
        turnstile: false,
      },
      vars: {
        storagePublicBaseUrl: true,
      },
    },
    workers: {
      router: 'demo-site-router',
      state: 'demo-site-state',
      'public-web': 'demo-site-public-web',
      auth: 'demo-site-auth',
      payment: 'demo-site-payment',
      member: 'demo-site-member',
      chat: 'demo-site-chat',
      admin: 'demo-site-admin',
    },
    resources: {
      incrementalCacheBucket: 'demo-site-opennext-cache',
      appStorageBucket: 'demo-site-storage',
      hyperdriveId: '00000000000000000000000000000001',
    },
    state: {
      schemaVersion: 1,
    },
  };

  assert.doesNotThrow(() =>
    validateSiteDeploySettings(settings, { siteConfig })
  );
});
