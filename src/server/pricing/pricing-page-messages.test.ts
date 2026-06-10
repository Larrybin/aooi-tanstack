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

test('pricing page messages fall back when optional localized landing namespace is missing', async () => {
  const { localizedPricingMessages, localizedLandingMessages } =
    await loadPricingPageMessages('ja');

  assert.equal(localizedPricingMessages.metadata?.title, '料金');
  assert.equal(
    localizedLandingMessages.faq?.title,
    'Questions founders usually ask before buying'
  );
  assert.equal(
    localizedLandingMessages.testimonials?.title,
    'What teams say after launch'
  );
});
