import assert from 'node:assert/strict';
import test from 'node:test';
import { invalidateRuntimeSettingsCacheVersion } from '@/domains/settings/application/settings-cache-version';
import {
  AI_RUNTIME_SETTING_KEYS,
  EMAIL_RUNTIME_SETTING_KEYS,
  PUBLIC_UI_SETTING_KEYS,
} from '@/domains/settings/registry';
import type { ServerRuntimeEnv } from '@/infra/runtime/env.server';

import { readTanStackAiRuntimeSettings } from '../../apps/web/src/server/ai-runtime';
import {
  readTanStackSettingsCached,
  type ReadTanStackSettingsCachedDeps,
} from '../../apps/web/src/server/billing-runtime';
import {
  createRuntimeRandomInt,
  readTanStackEmailRuntimeSettings,
  readTanStackEmailRuntimeSettingsFresh,
} from '../../apps/web/src/server/email-runtime';
import { readTanStackPublicUiConfigCached } from '../../apps/web/src/server/public-ui-config-runtime';

const TEST_RUNTIME_ENV: ServerRuntimeEnv = {
  databaseProvider: 'postgres',
  databaseUrl: 'postgres://example.test/db',
  dbSingletonEnabled: false,
  appEnvironment: 'test',
  internalEntitlementGrantsEnabled: false,
  authSecret: '',
  authBaseUrl: '',
};

function buildDeps(input: {
  cacheKey: string;
  now: () => number;
  cacheTtlMs?: number;
  readConfigRows: ReadTanStackSettingsCachedDeps['readConfigRows'];
}): ReadTanStackSettingsCachedDeps {
  return {
    cacheKey: input.cacheKey,
    cacheTtlMs: input.cacheTtlMs,
    now: input.now,
    getTanStackCloudflareBindings: async () => null,
    getRuntimeEnv: () => TEST_RUNTIME_ENV,
    isWorkersRuntime: () => false,
    readConfigRows: input.readConfigRows,
  };
}

test('readTanStackSettingsCached reuses rows until its ttl expires', async () => {
  let calls = 0;
  let now = 0;
  const deps = buildDeps({
    cacheKey: 'settings-cache-test',
    cacheTtlMs: 1000,
    now: () => now,
    readConfigRows: async () => {
      calls += 1;
      return [
        {
          name: PUBLIC_UI_SETTING_KEYS.aiEnabled,
          value: calls === 1 ? 'true' : 'false',
        },
      ];
    },
  });

  assert.equal(
    (await readTanStackSettingsCached(deps))[PUBLIC_UI_SETTING_KEYS.aiEnabled],
    'true'
  );
  assert.equal(
    (await readTanStackSettingsCached(deps))[PUBLIC_UI_SETTING_KEYS.aiEnabled],
    'true'
  );
  assert.equal(calls, 1);

  now = 1001;

  assert.equal(
    (await readTanStackSettingsCached(deps))[PUBLIC_UI_SETTING_KEYS.aiEnabled],
    'false'
  );
  assert.equal(calls, 2);
});

test('readTanStackSettingsCached observes settings invalidation', async () => {
  let calls = 0;
  const deps = buildDeps({
    cacheKey: 'settings-cache-invalidation-test',
    now: () => 0,
    readConfigRows: async () => {
      calls += 1;
      return [
        {
          name: PUBLIC_UI_SETTING_KEYS.aiEnabled,
          value: calls === 1 ? 'true' : 'false',
        },
      ];
    },
  });

  assert.equal(
    (await readTanStackSettingsCached(deps))[PUBLIC_UI_SETTING_KEYS.aiEnabled],
    'true'
  );

  invalidateRuntimeSettingsCacheVersion();

  assert.equal(
    (await readTanStackSettingsCached(deps))[PUBLIC_UI_SETTING_KEYS.aiEnabled],
    'false'
  );
  assert.equal(calls, 2);
});

test('readTanStackPublicUiConfigCached keeps cached-mode public settings cached', async () => {
  let calls = 0;
  const deps = buildDeps({
    cacheKey: 'public-ui-cache-test',
    now: () => 0,
    readConfigRows: async () => {
      calls += 1;
      return [
        {
          name: PUBLIC_UI_SETTING_KEYS.aiEnabled,
          value: calls === 1 ? 'true' : 'false',
        },
      ];
    },
  });

  assert.equal((await readTanStackPublicUiConfigCached(deps)).aiEnabled, true);
  assert.equal((await readTanStackPublicUiConfigCached(deps)).aiEnabled, true);
  assert.equal(calls, 1);
});

test('readTanStackAiRuntimeSettings defaults to cached and preserves fresh mode', async () => {
  let calls = 0;
  const deps = buildDeps({
    cacheKey: 'ai-runtime-cache-test',
    now: () => 0,
    readConfigRows: async () => {
      calls += 1;
      return [
        {
          name: AI_RUNTIME_SETTING_KEYS.aiEnabled,
          value: calls === 1 ? 'true' : 'false',
        },
      ];
    },
  });

  assert.equal(
    (await readTanStackAiRuntimeSettings('cached', deps)).aiEnabled,
    true
  );
  assert.equal(
    (await readTanStackAiRuntimeSettings('cached', deps)).aiEnabled,
    true
  );
  assert.equal(calls, 1);

  assert.equal(
    (await readTanStackAiRuntimeSettings('fresh', deps)).aiEnabled,
    false
  );
  assert.equal(calls, 2);
});

test('readTanStackEmailRuntimeSettings defaults to cached and preserves fresh mode', async () => {
  let calls = 0;
  const deps = buildDeps({
    cacheKey: 'email-runtime-cache-test',
    now: () => 0,
    readConfigRows: async () => {
      calls += 1;
      return [
        {
          name: EMAIL_RUNTIME_SETTING_KEYS.resendSenderEmail,
          value: calls === 1 ? 'ops@example.com' : 'ops-next@example.com',
        },
      ];
    },
  });

  assert.equal(
    (await readTanStackEmailRuntimeSettings(deps)).resendSenderEmail,
    'ops@example.com'
  );
  assert.equal(
    (await readTanStackEmailRuntimeSettings(deps)).resendSenderEmail,
    'ops@example.com'
  );
  assert.equal(calls, 1);

  assert.equal(
    (await readTanStackEmailRuntimeSettingsFresh(deps)).resendSenderEmail,
    'ops-next@example.com'
  );
  assert.equal(calls, 2);
});

test('createRuntimeRandomInt retries rejected values to avoid modulo bias', () => {
  const values = [0xffffffff, 5];
  let calls = 0;

  const result = createRuntimeRandomInt(0, 10, (array) => {
    if (!(array instanceof Uint32Array)) {
      throw new TypeError('expected Uint32Array');
    }
    array[0] = values[calls] ?? 0;
    calls += 1;
    return array;
  });

  assert.equal(result, 5);
  assert.equal(calls, 2);
});
