import assert from 'node:assert/strict';
import test from 'node:test';
import type { PublicUiConfig } from '@/domains/settings/application/settings-runtime.contracts';

import { buildGetConfigsLogic } from './get-configs-logic';

const CACHED_CONFIG: PublicUiConfig = {
  aiEnabled: true,
  localeSwitcherEnabled: false,
  socialLinksEnabled: false,
  socialLinksJson: '',
  socialLinks: [],
  affiliate: {
    affonsoEnabled: false,
    promotekitEnabled: false,
  },
};

const FRESH_CONFIG: PublicUiConfig = {
  ...CACHED_CONFIG,
  aiEnabled: false,
};

test('config/get-configs 默认读取 cached public-config', async () => {
  const handler = buildGetConfigsLogic({
    resolveConfigConsistencyMode: () => 'cached',
    getPublicUiConfigCached: async () => CACHED_CONFIG,
    getPublicUiConfigFresh: async () => FRESH_CONFIG,
  });

  const response = await handler(
    new Request('http://localhost/api/config/get-configs')
  );
  const body = (await response.json()) as {
    data: { aiEnabled: boolean };
  };

  assert.equal(response.status, 200);
  assert.equal(body.data.aiEnabled, true);
});

test('config/get-configs 在 fresh 模式下读取 fresh public-config', async () => {
  const handler = buildGetConfigsLogic({
    resolveConfigConsistencyMode: () => 'fresh',
    getPublicUiConfigCached: async () => CACHED_CONFIG,
    getPublicUiConfigFresh: async () => FRESH_CONFIG,
  });

  const response = await handler(
    new Request('http://localhost/api/config/get-configs', {
      headers: {
        'x-aooi-config-consistency': 'fresh',
      },
    })
  );
  const body = (await response.json()) as {
    data: { aiEnabled: boolean };
  };

  assert.equal(response.status, 200);
  assert.equal(body.data.aiEnabled, false);
});
