import assert from 'node:assert/strict';
import test from 'node:test';
import { PaymentType } from '@/domains/billing/domain/payment';
import { OrderStatus } from '@/domains/billing/infra/order';

import {
  buildCallbackUrl,
  buildFailedCheckoutOrderUpdate,
  requiresPaymentProductId,
} from './checkout';

test('buildFailedCheckoutOrderUpdate records provider checkout failures as failed', () => {
  const checkoutOrder = {
    description: 'Pro',
    customer: {
      email: 'user@example.com',
    },
    metadata: {
      order_no: 'order_1',
      user_id: 'user_1',
    },
    successUrl: 'https://example.com/success',
    cancelUrl: 'https://example.com/pricing',
    price: {
      amount: 999,
      currency: 'USD',
    },
  };

  const update = buildFailedCheckoutOrderUpdate(checkoutOrder);

  assert.equal(update.status, OrderStatus.FAILED);
  assert.equal(update.checkoutInfo, JSON.stringify(checkoutOrder));
});

test('requiresPaymentProductId only requires provider product ids for Creem', () => {
  assert.equal(requiresPaymentProductId('creem'), true);
  assert.equal(requiresPaymentProductId('stripe'), false);
  assert.equal(requiresPaymentProductId('paypal'), false);
  assert.equal(requiresPaymentProductId('none'), false);
});

test('buildCallbackUrl uses NEXT_PUBLIC_APP_URL for preview runtime callbacks', () => {
  const previousAppUrl = process.env.NEXT_PUBLIC_APP_URL;
  process.env.NEXT_PUBLIC_APP_URL =
    'https://aooi-ai-remover-preview-router.example.workers.dev';

  try {
    const result = buildCallbackUrl({
      settings: {
        locale: '',
        defaultLocale: '',
        provider: 'creem',
        paymentCapability: 'creem',
        creemProductIds: '{}',
      },
      locale: '',
      paymentType: PaymentType.SUBSCRIPTION,
    });

    assert.equal(
      result.callbackBaseUrl,
      'https://aooi-ai-remover-preview-router.example.workers.dev'
    );
    assert.equal(
      result.callbackUrl,
      'https://aooi-ai-remover-preview-router.example.workers.dev/settings/billing'
    );
  } finally {
    if (previousAppUrl === undefined) {
      delete process.env.NEXT_PUBLIC_APP_URL;
    } else {
      process.env.NEXT_PUBLIC_APP_URL = previousAppUrl;
    }
  }
});
