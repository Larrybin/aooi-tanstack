import assert from 'node:assert/strict';
import test from 'node:test';

import { buildPricingSignInUrl } from './pricing-auth-redirect';

test('buildPricingSignInUrl localizes non-default sign-in routes', () => {
  assert.equal(
    buildPricingSignInUrl({
      callbackUrl: '/zh/pricing?plan=pro#checkout',
      locale: 'zh',
    }),
    '/zh/sign-in?callbackUrl=%2Fpricing%3Fplan%3Dpro%23checkout'
  );
});

test('buildPricingSignInUrl keeps default locale sign-in routes unprefixed', () => {
  assert.equal(
    buildPricingSignInUrl({
      callbackUrl: '/pricing',
      locale: 'en',
    }),
    '/sign-in?callbackUrl=%2Fpricing'
  );
});
