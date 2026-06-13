import assert from 'node:assert/strict';
import test from 'node:test';
import type { PricingPageData } from '@/domains/pricing/application/pricing-page';

import { buildPricingRouteData } from './pricing-route-resolver';

test('buildPricingRouteData includes landing shell data', () => {
  const data = buildPricingRouteData({
    locale: 'en',
    head: {},
    pricing: {
      title: 'Pricing',
      items: [],
    },
  } satisfies PricingPageData);

  assert.ok(data);
  assert.equal(data.shell.header.signInHref, '/sign-in');
  assert.equal(typeof data.shell.footer.copyright, 'string');
});
