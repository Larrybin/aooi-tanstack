import assert from 'node:assert/strict';
import test from 'node:test';

import {
  findPricingItemByProductId,
  isPricingItemCheckoutEnabled,
  resolvePricingEntitlements,
} from './pricing';

import type { Pricing } from '@/shared/types/blocks/pricing';

const pricing = {
  items: [
    {
      product_id: 'free',
      title: 'Free',
      interval: 'month',
      amount: 0,
      currency: 'USD',
      checkout_enabled: false,
      entitlements: {
        low_res_download: true,
      },
    },
    {
      product_id: 'pro-monthly',
      title: 'Pro',
      interval: 'month',
      amount: 999,
      currency: 'USD',
      checkout_enabled: true,
      entitlements: {
        monthly_removals: 500,
      },
    },
    {
      product_id: 'studio-monthly',
      title: 'Studio',
      interval: 'month',
      amount: 2999,
      currency: 'USD',
    },
  ],
} satisfies Pricing;

test('pricing lookup: resolves product items by product_id', () => {
  assert.equal(
    findPricingItemByProductId(pricing, 'pro-monthly')?.title,
    'Pro'
  );
  assert.equal(findPricingItemByProductId(pricing, 'missing'), undefined);
});

test('pricing checkout policy: free is disabled and paid plans are enabled', () => {
  const free = findPricingItemByProductId(pricing, 'free');
  const pro = findPricingItemByProductId(pricing, 'pro-monthly');
  const studio = findPricingItemByProductId(pricing, 'studio-monthly');

  assert.ok(free);
  assert.ok(pro);
  assert.ok(studio);
  assert.equal(isPricingItemCheckoutEnabled(free), false);
  assert.equal(isPricingItemCheckoutEnabled(pro), true);
  assert.equal(isPricingItemCheckoutEnabled(studio), true);
});

test('resolvePricingEntitlements returns plan entitlements from pricing data', () => {
  assert.deepEqual(resolvePricingEntitlements('pro-monthly', pricing), {
    monthly_removals: 500,
  });
  assert.equal(resolvePricingEntitlements('missing', pricing), undefined);
});
