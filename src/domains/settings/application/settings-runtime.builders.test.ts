import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildAdsRuntimeSettings,
  buildAffiliateRuntimeSettings,
  buildAiRuntimeSettings,
  buildAnalyticsRuntimeSettings,
  buildAuthUiRuntimeSettings,
  buildBillingRuntimeSettings,
  buildCustomerServiceRuntimeSettings,
  buildEmailRuntimeSettings,
  buildPublicUiConfig,
} from './settings-runtime.builders';

test('typed runtime builders 返回 closed subsets，不暴露 raw/configs 后门', () => {
  const analytics = buildAnalyticsRuntimeSettings({
    google_analytics_id: 'G-123',
    raw: 'forbidden',
  });
  const affiliate = buildAffiliateRuntimeSettings({
    affonso_enabled: 'true',
    affonso_id: 'aff-1',
    affonso_cookie_duration: '45',
    configs: 'forbidden',
  });
  const customerService = buildCustomerServiceRuntimeSettings({
    crisp_enabled: 'true',
    crisp_website_id: 'crisp-1',
    raw: 'forbidden',
  });
  const ads = buildAdsRuntimeSettings({
    ads_enabled: 'true',
    ads_provider: 'adsense',
    adsense_client_id: 'ca-pub-123',
    configs: 'forbidden',
  });
  const email = buildEmailRuntimeSettings({
    resend_sender_email: 'ops@example.com',
    raw: 'forbidden',
  });

  for (const value of [analytics, affiliate, customerService, ads, email]) {
    assert.equal('configs' in (value as Record<string, unknown>), false);
    assert.equal('raw' in (value as Record<string, unknown>), false);
  }
});

test('buildAffiliateRuntimeSettings 对 cookie duration 使用正整数并回退默认值', () => {
  const explicit = buildAffiliateRuntimeSettings({
    affonso_cookie_duration: '60',
  });
  const fallback = buildAffiliateRuntimeSettings({
    affonso_cookie_duration: 'NaN',
  });

  assert.equal(explicit.affonsoCookieDuration, 60);
  assert.equal(fallback.affonsoCookieDuration, 30);
});

test('buildAdsRuntimeSettings 对非法 provider 收敛为空字符串', () => {
  const settings = buildAdsRuntimeSettings({
    ads_enabled: 'true',
    ads_provider: 'unexpected',
  });

  assert.equal(settings.adsProvider, '');
});

test('only auth ui runtime builder accepts worker-side bindings', () => {
  assert.equal(buildAuthUiRuntimeSettings.length, 2);

  for (const builder of [
    buildPublicUiConfig,
    buildBillingRuntimeSettings,
    buildAiRuntimeSettings,
    buildAnalyticsRuntimeSettings,
    buildAffiliateRuntimeSettings,
    buildCustomerServiceRuntimeSettings,
    buildAdsRuntimeSettings,
    buildEmailRuntimeSettings,
  ]) {
    assert.equal(builder.length, 1);
  }
});
