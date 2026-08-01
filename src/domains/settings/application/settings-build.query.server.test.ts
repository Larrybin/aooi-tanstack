import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { site } from '@/site';

import {
  buildAuthUiSettingsFromSite,
  buildBillingUiSettingsFromSite,
  buildPublicUiConfigFromSite,
  readBuildAuthUiSettings,
  readBuildBillingUiSettings,
  readBuildPricingDisplayConfig,
  readBuildPublicUiConfig,
} from './settings-build.query';

test('build auth settings are conservative and do not synthesize Google client ids', () => {
  const settings = buildAuthUiSettingsFromSite({
    capabilities: {
      enabledModules: ['auth', 'billing', 'ai'],
      paymentProvider: 'creem',
    },
  });

  assert.equal(settings.emailAuthEnabled, false);
  assert.equal(settings.googleAuthEnabled, false);
  assert.equal(settings.googleOneTapEnabled, false);
  assert.equal(settings.googleClientId, '');
  assert.equal(settings.githubAuthEnabled, false);
  assert.equal(readBuildAuthUiSettings().emailAuthEnabled, false);
  assert.equal(readBuildAuthUiSettings().googleClientId, '');
});

test('build billing settings do not evaluate secrets or provider product mapping readiness', () => {
  const settings = buildBillingUiSettingsFromSite({
    capabilities: {
      enabledModules: ['auth', 'billing', 'ai'],
      paymentProvider: 'creem',
    },
  });

  assert.deepEqual(settings, {
    locale: '',
    defaultLocale: 'en',
    provider: 'creem',
    paymentCapability: 'creem',
    creemEnvironment: 'sandbox',
    creemProductIds: '',
  });
  assert.equal('status' in settings, false);
  assert.equal('missing' in settings, false);
  assert.equal('requiredSecrets' in settings, false);
});

test('build public UI settings come from source-controlled site capabilities', () => {
  const settings = readBuildPublicUiConfig();

  assert.equal(
    settings.aiEnabled,
    site.capabilities.enabledModules.includes('ai')
  );
  assert.equal(settings.localeSwitcherEnabled, false);
  assert.equal(settings.socialLinksEnabled, false);
  assert.equal(settings.socialLinksJson, '');
  assert.deepEqual(settings.socialLinks, []);
});

test('build public UI settings preserve AI capability visibility semantics', () => {
  assert.equal(
    buildPublicUiConfigFromSite({
      capabilities: { enabledModules: ['ai'], paymentProvider: 'none' },
    }).aiEnabled,
    true
  );
  assert.equal(
    buildPublicUiConfigFromSite({
      capabilities: { enabledModules: [], paymentProvider: 'none' },
    }).aiEnabled,
    false
  );
});

test('pricing display config is read from the selected site pricing config', () => {
  const pricing = readBuildPricingDisplayConfig();
  const sourcePricing = JSON.parse(
    readFileSync(path.resolve('sites', site.key, 'pricing.json'), 'utf8')
  );

  assert.deepEqual(pricing, sourcePricing);
  assert.equal(
    pricing?.pricing?.items?.[0]?.product_id,
    sourcePricing.pricing.items[0].product_id
  );
});

test('current build billing reader follows source-controlled site capability only', () => {
  const settings = readBuildBillingUiSettings();
  assert.equal(settings.paymentCapability, site.capabilities.paymentProvider);
  assert.equal(settings.provider, site.capabilities.paymentProvider);
});
