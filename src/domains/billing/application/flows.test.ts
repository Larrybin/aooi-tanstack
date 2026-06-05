import assert from 'node:assert/strict';
import test from 'node:test';
import { parseProductEntitlementsJson } from '@/domains/entitlements/domain/entitlements';

import { buildBillingEntitlementGrantForOrder } from '../domain/entitlement-grant';
import { PaymentType } from '../domain/payment';
import type { Order } from '../infra/order';

function order(overrides: Partial<Order> = {}): Order {
  return {
    orderNo: 'order_1',
    userId: 'user_1',
    userEmail: 'user@example.com',
    paymentType: PaymentType.ONE_TIME,
    productId: 'lifetime-basic',
    ...overrides,
  } as Order;
}

test('buildBillingEntitlementGrantForOrder creates a permanent billing grant for one-time entitlements', () => {
  const grant = buildBillingEntitlementGrantForOrder({
    order: order(),
    siteKey: 'text-to-speech-generator',
    productKey: 'text-to-speech-generator',
    environment: 'production',
    now: new Date('2026-06-05T00:00:00Z'),
    createId: () => 'grant_1',
    pricing: {
      items: [
        {
          title: 'Lifetime Basic',
          interval: 'one-time',
          amount: 2900,
          currency: 'USD',
          product_id: 'lifetime-basic',
          entitlements: {
            monthly_characters: 100000,
            single_request_characters: 15000,
            history_items: 20,
            retention_days: 30,
            lifetime_access: true,
          },
        },
      ],
    },
  });

  assert.equal(grant?.id, 'grant_1');
  assert.equal(grant?.source, 'billing');
  assert.equal(grant?.reason, 'order:order_1');
  assert.equal(grant?.environment, 'production');
  assert.deepEqual(
    parseProductEntitlementsJson({
      productKey: 'text-to-speech-generator',
      value: grant?.entitlementsJson ?? '{}',
    }),
    {
      monthly_characters: 100000,
      single_request_characters: 15000,
      history_items: 20,
      retention_days: 30,
      lifetime_access: true,
    }
  );
});

test('buildBillingEntitlementGrantForOrder ignores one-time credit products without entitlements', () => {
  const grant = buildBillingEntitlementGrantForOrder({
    order: order({ productId: 'extra-credits-250k' }),
    siteKey: 'text-to-speech-generator',
    productKey: 'text-to-speech-generator',
    environment: 'production',
    pricing: {
      items: [
        {
          title: 'Extra Credits',
          interval: 'one-time',
          amount: 900,
          currency: 'USD',
          product_id: 'extra-credits-250k',
          credits: 250000,
          valid_days: 365,
        },
      ],
    },
  });

  assert.equal(grant, undefined);
});
