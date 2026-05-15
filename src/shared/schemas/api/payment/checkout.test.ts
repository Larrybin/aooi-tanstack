import assert from 'node:assert/strict';
import test from 'node:test';

import { PaymentCheckoutBodySchema } from './checkout';

test('PaymentCheckoutBodySchema 不再接受 payment_provider', () => {
  const result = PaymentCheckoutBodySchema.safeParse({
    product_id: 'starter',
    payment_provider: 'stripe',
  });

  assert.equal(result.success, false);
  assert.match(JSON.stringify(result.error?.issues ?? []), /unrecognized_keys/i);
});

test('PaymentCheckoutBodySchema 不再接受客户端 metadata', () => {
  const result = PaymentCheckoutBodySchema.safeParse({
    product_id: 'starter',
    metadata: {
      user_id: 'attacker',
    },
  });

  assert.equal(result.success, false);
  assert.match(JSON.stringify(result.error?.issues ?? []), /unrecognized_keys/i);
});

test('PaymentCheckoutBodySchema 接受最小 checkout body', () => {
  const result = PaymentCheckoutBodySchema.safeParse({
    product_id: 'starter',
  });

  assert.equal(result.success, true);
});

test('PaymentCheckoutBodySchema 接受 pricing client 的 checkout body', () => {
  const result = PaymentCheckoutBodySchema.safeParse({
    product_id: 'pro-monthly',
    currency: 'USD',
    locale: 'en',
  });

  assert.equal(result.success, true);
});
