import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveSiteDeployContract } from '../../scripts/lib/site-deploy-contract.mjs';
import { readSitePreviewDeploySettings } from '../../scripts/lib/site-deploy-settings.mjs';

test('deploy contract resolver 在相同输入下输出完全一致', () => {
  const first = resolveSiteDeployContract({
    rootDir: process.cwd(),
    siteKey: 'mamamiya',
  });
  const second = resolveSiteDeployContract({
    rootDir: process.cwd(),
    siteKey: 'mamamiya',
  });

  assert.deepEqual(second, first);
});

test('deploy contract resolver 默认使用 production profile', () => {
  const contract = resolveSiteDeployContract({
    rootDir: process.cwd(),
    siteKey: 'ai-remover',
    processEnv: {},
  });

  assert.equal(contract.deployProfile, 'production');
  assert.equal(contract.route.mode, 'custom-domain');
  assert.equal(contract.router.workerName, 'aooi-ai-remover-router');
});

test('deploy contract resolver 从 active worker map 排除 disabled chat', () => {
  const contract = resolveSiteDeployContract({
    rootDir: process.cwd(),
    siteKey: 'ai-remover',
    processEnv: {},
  });

  assert.equal(contract.workers.chat, undefined);
  assert.equal(contract.serverWorkers.chat, undefined);
  assert.deepEqual(Object.keys(contract.serverWorkers), [
    'public-web',
    'auth',
    'payment',
    'member',
    'admin',
  ]);
  assert.equal('CHAT_WORKER' in contract.router.serviceBindings, false);
  assert.equal('CHAT_WORKER_VERSION_ID' in contract.router.versionVars, false);
  assert.equal('CHAT_WORKER_NAME' in contract.router.workerNameVars, false);
});

test('deploy contract resolver 为 preview 派生 workers.dev 资源', () => {
  const previewSettings = readSitePreviewDeploySettings({
    rootDir: process.cwd(),
    siteKey: 'ai-remover',
  });
  const contract = resolveSiteDeployContract({
    rootDir: process.cwd(),
    siteKey: 'ai-remover',
    deployProfile: 'preview',
    processEnv: {
      CF_WORKERS_DEV_SUBDOMAIN: 'aooi-preview',
    },
  });

  assert.equal(contract.deployProfile, 'preview');
  assert.equal(contract.route.mode, 'workers-dev');
  assert.equal(
    contract.appOrigin,
    'https://aooi-ai-remover-preview-router.aooi-preview.workers.dev'
  );
  assert.equal(
    contract.resources.incrementalCacheBucket,
    'aooi-ai-remover-preview-opennext-cache'
  );
  assert.equal(
    contract.resources.appStorageBucket,
    'aooi-ai-remover-preview-storage'
  );
  assert.equal(
    contract.resources.hyperdriveId,
    previewSettings.resources.hyperdriveId
  );
  assert.equal(contract.router.workerName, 'aooi-ai-remover-preview-router');
  assert.equal(
    contract.serverWorkers['public-web'].workerName,
    'aooi-ai-remover-preview-public-web'
  );
});

test('deploy contract resolver 在 preview 缺少 workers.dev subdomain 时失败', () => {
  assert.throws(
    () =>
      resolveSiteDeployContract({
        rootDir: process.cwd(),
        siteKey: 'ai-remover',
        deployProfile: 'preview',
        processEnv: {},
      }),
    /CF_WORKERS_DEV_SUBDOMAIN is required/i
  );
});

test('deploy contract resolver 在 preview 缺少 overlay 时失败', () => {
  assert.throws(
    () =>
      resolveSiteDeployContract({
        rootDir: process.cwd(),
        siteKey: 'mamamiya',
        deployProfile: 'preview',
        processEnv: {
          CF_WORKERS_DEV_SUBDOMAIN: 'aooi-preview',
        },
      }),
    /missing preview deploy settings/i
  );
});
