import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import type {
  AdsRuntimeSettings,
  AffiliateRuntimeSettings,
  AnalyticsRuntimeSettings,
  CustomerServiceRuntimeSettings,
} from '@/domains/settings/application/settings-runtime.contracts';
import { renderToStaticMarkup } from 'react-dom/server';

import { resolveRootRuntimeInjections } from './root-runtime-injections';

function createRuntimeProvider(prefix: string) {
  return {
    name: 'adsense' as const,
    supportsZone: () => false,
    renderZone: () => null,
    getAdsTxtEntry: () => null,
    getMetaTags: () =>
      createElement('meta', {
        key: `${prefix}-meta`,
        name: `${prefix}-meta`,
        content: '1',
      }),
    getHeadScripts: () =>
      createElement('script', {
        key: `${prefix}-head`,
        id: `${prefix}-head`,
        dangerouslySetInnerHTML: { __html: '' },
      }),
    getBodyScripts: () =>
      createElement('script', {
        key: `${prefix}-body`,
        id: `${prefix}-body`,
        dangerouslySetInnerHTML: { __html: '' },
      }),
  };
}

test('root runtime injections: typed cached readers feed the matching factories and render nodes', async () => {
  const adsSettings = {
    adsEnabled: true,
    adsProvider: 'adsense',
    adsenseClientId: 'ca-pub-123',
    adsenseSlotLandingInlinePrimary: 'landing-slot',
    adsenseSlotBlogPostInline: '',
    adsenseSlotBlogPostFooter: '',
    adsterraMode: '',
    adsterraGlobalSnippet: '',
    adsterraZoneLandingInlinePrimarySnippet: '',
    adsterraZoneBlogPostInlineSnippet: '',
    adsterraZoneBlogPostFooterSnippet: '',
    adsterraAdsTxtEntry: '',
  } satisfies AdsRuntimeSettings;
  const analyticsSettings = {
    googleAnalyticsId: 'G-123',
    clarityId: 'clarity-1',
    plausibleDomain: 'example.com',
    plausibleSrc: 'https://plausible.example/script.js',
    openpanelClientId: 'openpanel-1',
  } satisfies AnalyticsRuntimeSettings;
  const affiliateSettings = {
    affonsoEnabled: true,
    affonsoId: 'affonso-1',
    affonsoCookieDuration: 30,
    promotekitEnabled: true,
    promotekitId: 'promotekit-1',
  } satisfies AffiliateRuntimeSettings;
  const customerServiceSettings = {
    crispEnabled: true,
    crispWebsiteId: 'crisp-1',
    tawkEnabled: true,
    tawkPropertyId: 'tawk-property',
    tawkWidgetId: 'tawk-widget',
  } satisfies CustomerServiceRuntimeSettings;

  const calls: string[] = [];
  const injections = await resolveRootRuntimeInjections({
    isProductionEnv: () => true,
    isDebugEnv: () => false,
    readAdsRuntimeSettingsCached: async () => {
      calls.push('read:ads');
      return adsSettings;
    },
    readAnalyticsRuntimeSettingsCached: async () => {
      calls.push('read:analytics');
      return analyticsSettings;
    },
    readAffiliateRuntimeSettingsCached: async () => {
      calls.push('read:affiliate');
      return affiliateSettings;
    },
    readCustomerServiceRuntimeSettingsCached: async () => {
      calls.push('read:customer-service');
      return customerServiceSettings;
    },
    createAdsRuntime: (settings) => {
      assert.equal(settings, adsSettings);
      calls.push('factory:ads');
      return {
        enabled: true,
        providerName: 'adsense',
        provider: createRuntimeProvider('ads'),
        supportedZones: new Set(),
        adsTxtEntry: null,
      };
    },
    createAnalyticsManager: (settings) => {
      assert.equal(settings, analyticsSettings);
      calls.push('factory:analytics');
      return createRuntimeProvider('analytics');
    },
    createAffiliateManager: (settings) => {
      assert.equal(settings, affiliateSettings);
      calls.push('factory:affiliate');
      return createRuntimeProvider('affiliate');
    },
    createCustomerServiceManager: (settings) => {
      assert.equal(settings, customerServiceSettings);
      calls.push('factory:customer-service');
      return createRuntimeProvider('customer-service');
    },
  });

  const markup = renderToStaticMarkup(
    createElement(
      'html',
      null,
      createElement(
        'head',
        null,
        injections.adsMetaTags,
        injections.adsHeadScripts,
        injections.analyticsMetaTags,
        injections.analyticsHeadScripts,
        injections.affiliateMetaTags,
        injections.affiliateHeadScripts,
        injections.customerServiceMetaTags,
        injections.customerServiceHeadScripts
      ),
      createElement(
        'body',
        null,
        injections.adsBodyScripts,
        injections.analyticsBodyScripts,
        injections.affiliateBodyScripts,
        injections.customerServiceBodyScripts
      )
    )
  );

  assert.deepEqual(calls, [
    'read:ads',
    'read:analytics',
    'read:affiliate',
    'read:customer-service',
    'factory:ads',
    'factory:analytics',
    'factory:affiliate',
    'factory:customer-service',
  ]);
  for (const token of [
    'name="ads-meta"',
    'id="ads-head"',
    'id="ads-body"',
    'name="analytics-meta"',
    'id="analytics-head"',
    'id="analytics-body"',
    'name="affiliate-meta"',
    'id="affiliate-head"',
    'id="affiliate-body"',
    'name="customer-service-meta"',
    'id="customer-service-head"',
    'id="customer-service-body"',
  ]) {
    assert.match(markup, new RegExp(token));
  }
});

test('root runtime injections: non production/debug env does not read runtime settings', async () => {
  const injections = await resolveRootRuntimeInjections({
    isProductionEnv: () => false,
    isDebugEnv: () => false,
    readAdsRuntimeSettingsCached: async () => {
      throw new Error('ads settings should not be read');
    },
    readAnalyticsRuntimeSettingsCached: async () => {
      throw new Error('analytics settings should not be read');
    },
    readAffiliateRuntimeSettingsCached: async () => {
      throw new Error('affiliate settings should not be read');
    },
    readCustomerServiceRuntimeSettingsCached: async () => {
      throw new Error('customer service settings should not be read');
    },
    createAdsRuntime: () => {
      throw new Error('ads factory should not run');
    },
    createAnalyticsManager: () => {
      throw new Error('analytics factory should not run');
    },
    createAffiliateManager: () => {
      throw new Error('affiliate factory should not run');
    },
    createCustomerServiceManager: () => {
      throw new Error('customer service factory should not run');
    },
  });

  assert.equal(injections.adsMetaTags, null);
  assert.equal(injections.analyticsHeadScripts, null);
  assert.equal(injections.affiliateBodyScripts, null);
  assert.equal(injections.customerServiceMetaTags, null);
});

test('root runtime injections: disabled runtime settings gate skips DB-backed readers in production', async () => {
  const injections = await resolveRootRuntimeInjections({
    isProductionEnv: () => true,
    isDebugEnv: () => false,
    shouldReadRuntimeSettings: () => false,
    readAdsRuntimeSettingsCached: async () => {
      throw new Error('ads settings should not be read');
    },
    readAnalyticsRuntimeSettingsCached: async () => {
      throw new Error('analytics settings should not be read');
    },
    readAffiliateRuntimeSettingsCached: async () => {
      throw new Error('affiliate settings should not be read');
    },
    readCustomerServiceRuntimeSettingsCached: async () => {
      throw new Error('customer service settings should not be read');
    },
    createAdsRuntime: () => {
      throw new Error('ads factory should not run');
    },
    createAnalyticsManager: () => {
      throw new Error('analytics factory should not run');
    },
    createAffiliateManager: () => {
      throw new Error('affiliate factory should not run');
    },
    createCustomerServiceManager: () => {
      throw new Error('customer service factory should not run');
    },
  });

  assert.equal(injections.adsMetaTags, null);
  assert.equal(injections.analyticsHeadScripts, null);
  assert.equal(injections.affiliateBodyScripts, null);
  assert.equal(injections.customerServiceMetaTags, null);
});
