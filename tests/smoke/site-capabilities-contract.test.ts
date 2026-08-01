import assert from 'node:assert/strict';
import test from 'node:test';

import {
  listConfiguredSiteKeys,
  readCurrentSiteConfig,
} from '../../scripts/lib/site-config';

test('every discovered site uses the v2 capability contract', () => {
  const siteKeys = listConfiguredSiteKeys();
  assert.ok(siteKeys.length > 0);

  for (const siteKey of siteKeys) {
    const site = readCurrentSiteConfig({ siteKey });
    assert.equal(site.configVersion, 2, siteKey);
    assert.ok(Array.isArray(site.capabilities.enabledModules), siteKey);
    assert.equal(
      site.capabilities.enabledModules.includes('billing'),
      site.capabilities.paymentProvider !== 'none',
      siteKey
    );
  }
});

test('known analytics-only sites keep their no-payment capability', () => {
  for (const siteKey of ['401k-calculator', 'mp4-compressor'] as const) {
    const site = readCurrentSiteConfig({ siteKey });
    assert.deepEqual(site.capabilities, {
      enabledModules: ['analytics'],
      paymentProvider: 'none',
    });
  }
});

test('known application site keeps billing and its provider together', () => {
  const site = readCurrentSiteConfig({ siteKey: 'ai-remover' });
  assert.ok(site.capabilities.enabledModules.includes('billing'));
  assert.equal(site.capabilities.paymentProvider, 'creem');
});
