import assert from 'node:assert/strict';
import test from 'node:test';

import {
  listConfiguredSiteKeys,
  readCurrentSiteConfig,
} from '../../scripts/lib/site-config.mjs';

const expected = {
  '401k-calculator': {
    enabledModules: ['analytics'],
    paymentProvider: 'none',
  },
  'ai-remover': {
    enabledModules: [
      'auth',
      'billing',
      'admin_settings',
      'storage',
      'analytics',
      'affiliate',
      'customer_service',
      'ads',
    ],
    paymentProvider: 'creem',
  },
  'background-remover': {
    enabledModules: [
      'auth',
      'billing',
      'admin_settings',
      'storage',
      'analytics',
      'affiliate',
      'customer_service',
      'ads',
    ],
    paymentProvider: 'creem',
  },
  'dev-local': {
    enabledModules: [
      'auth',
      'admin_settings',
      'docs',
      'blog',
      'storage',
      'analytics',
      'affiliate',
      'customer_service',
      'ads',
    ],
    paymentProvider: 'none',
  },
  mamamiya: {
    enabledModules: [
      'auth',
      'admin_settings',
      'docs',
      'blog',
      'storage',
      'analytics',
      'affiliate',
      'customer_service',
      'ads',
    ],
    paymentProvider: 'none',
  },
  'mp4-compressor': {
    enabledModules: ['analytics'],
    paymentProvider: 'none',
  },
  'random-group-generator': {
    enabledModules: ['analytics'],
    paymentProvider: 'none',
  },
  'text-to-speech-generator': {
    enabledModules: [
      'auth',
      'billing',
      'admin_settings',
      'storage',
      'analytics',
      'affiliate',
      'customer_service',
      'ads',
    ],
    paymentProvider: 'creem',
  },
} as const;

test('every configured site uses the v2 capability contract', () => {
  assert.deepEqual(listConfiguredSiteKeys(), Object.keys(expected).sort());

  for (const [siteKey, capabilities] of Object.entries(expected)) {
    const site = readCurrentSiteConfig({ siteKey });
    assert.equal(site.configVersion, 2, siteKey);
    assert.deepEqual(site.capabilities, capabilities, siteKey);
  }
});
