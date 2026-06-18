import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';

import {
  resolveRootRuntimeInjections,
  type RootRuntimeInjectionDeps,
} from './root-runtime-injections';

function emptyProvider() {
  return {
    getMetaTags: () => null,
    getHeadScripts: () => null,
    getBodyScripts: () => null,
  };
}

function buildDeps(
  overrides: Partial<RootRuntimeInjectionDeps> = {}
): RootRuntimeInjectionDeps {
  return {
    isProductionEnv: () => false,
    isDebugEnv: () => true,
    shouldReadRuntimeSettings: () => true,
    readAdsRuntimeSettingsCached: async () => ({}) as never,
    readAnalyticsRuntimeSettingsCached: async () => ({}) as never,
    readAffiliateRuntimeSettingsCached: async () => ({}) as never,
    readCustomerServiceRuntimeSettingsCached: async () => ({}) as never,
    createAdsRuntime: () => ({ enabled: false }),
    createAnalyticsManager: emptyProvider,
    createAffiliateManager: emptyProvider,
    createCustomerServiceManager: emptyProvider,
    ...overrides,
  };
}

test('resolveRootRuntimeInjections skips runtime settings outside production and debug', async () => {
  let readSettings = false;

  const result = await resolveRootRuntimeInjections(
    buildDeps({
      isDebugEnv: () => false,
      readAdsRuntimeSettingsCached: async () => {
        readSettings = true;
        return {} as never;
      },
    })
  );

  assert.deepEqual(result, { meta: [], headScripts: [], bodyScripts: [] });
  assert.equal(readSettings, false);
});

test('resolveRootRuntimeInjections returns native head and body descriptors', async () => {
  const result = await resolveRootRuntimeInjections(
    buildDeps({
      createAdsRuntime: () => ({
        enabled: true,
        providerName: 'adsense',
        supportedZones: new Set(),
        adsTxtEntry: null,
        provider: {
          getMetaTags: () => (
            <meta name="google-adsense-account" content="ca-pub-test" />
          ),
          getHeadScripts: () => (
            <script
              src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-test"
              crossOrigin="anonymous"
            />
          ),
          getBodyScripts: () => null,
          supportsZone: () => false,
          renderZone: () => null,
          getAdsTxtEntry: () => null,
        },
      }),
      createAnalyticsManager: () => ({
        getMetaTags: () => null,
        getHeadScripts: () => (
          <>
            <script src="https://example.test/analytics.js" async />
            <script
              id="analytics-inline"
              dangerouslySetInnerHTML={{ __html: 'window.analyticsTest = 1;' }}
            />
          </>
        ),
        getBodyScripts: () => null,
      }),
      createAffiliateManager: () => ({
        getMetaTags: () => null,
        getHeadScripts: () => null,
        getBodyScripts: () => (
          <script id="affiliate-body">window.affiliateTest = 1;</script>
        ),
      }),
    })
  );

  assert.deepEqual(result.meta, [
    { name: 'google-adsense-account', content: 'ca-pub-test' },
  ]);
  assert.equal(result.headScripts[0]?.crossOrigin, 'anonymous');
  assert.equal(result.headScripts[1]?.src, 'https://example.test/analytics.js');
  assert.equal(result.headScripts[1]?.async, true);
  assert.equal(result.headScripts[2]?.id, 'analytics-inline');
  assert.equal(
    result.headScripts[2]?.children?.trim(),
    'window.analyticsTest = 1;'
  );
  assert.equal(result.bodyScripts[0]?.id, 'affiliate-body');
  assert.equal(
    result.bodyScripts[0]?.children?.trim(),
    'window.affiliateTest = 1;'
  );
});
