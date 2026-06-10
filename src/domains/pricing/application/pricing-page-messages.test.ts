import assert from 'node:assert/strict';
import test from 'node:test';

import { loadPricingPageMessages } from './pricing-page-messages';

test('pricing page messages load pricing and landing namespaces from the same source as Next pricing', async () => {
  const { localizedPricingMessages, localizedLandingMessages } =
    await loadPricingPageMessages('zh');

  assert.equal(localizedPricingMessages.metadata?.title, '价格');
  assert.equal(localizedPricingMessages.pricing.title, '价格');
  assert.equal(
    localizedLandingMessages.faq?.title,
    '关于 Roller Rabbit 的常见问题'
  );
  assert.equal(
    localizedLandingMessages.testimonials?.title,
    '用户对 Roller Rabbit 的评价'
  );
});
