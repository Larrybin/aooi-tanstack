import assert from 'node:assert/strict';
import test from 'node:test';

import { withApi } from '@/shared/lib/api/route';
import type { SitePricing } from '@/shared/types/blocks/pricing';

import { createPaymentCheckoutPostAction } from './action';

const sitePricing = {
  pricing: {
    items: [
      {
        product_id: 'free',
        title: 'Free',
        interval: 'month',
        amount: 0,
        currency: 'USD',
        checkout_enabled: false,
      },
      {
        product_id: 'pro-monthly',
        title: 'Pro',
        interval: 'month',
        amount: 999,
        currency: 'USD',
        checkout_enabled: true,
        product_name: 'AI Remover Pro Monthly',
        plan_name: 'Pro',
      },
    ],
  },
} satisfies SitePricing;

function createApiContextStub({
  productId,
  onRequireUser,
}: {
  productId: string;
  onRequireUser?: () => void;
}) {
  return () =>
    ({
      log: {
        debug: () => undefined,
        info: () => undefined,
        warn: () => undefined,
        error: () => undefined,
      },
      parseJson: async () => ({
        product_id: productId,
        currency: 'USD',
        locale: 'en',
      }),
      requireUser: async () => {
        onRequireUser?.();
        return {
          id: 'user_1',
          email: 'user@example.com',
        };
      },
    }) as never;
}

function createHandler({
  productId,
  sitePricingOverride = sitePricing,
  onRequireUser,
  onCheckout,
}: {
  productId: string;
  sitePricingOverride?: SitePricing | null;
  onRequireUser?: () => void;
  onCheckout?: (pricingItemProductId: string) => void;
}) {
  return withApi(
    createPaymentCheckoutPostAction({
      requirePaymentCapability: () => undefined,
      createApiContext: createApiContextStub({ productId, onRequireUser }),
      sitePricing: sitePricingOverride,
      readBillingRuntimeSettings: async () =>
        ({
          provider: 'creem',
          paymentCapability: 'creem',
          creemEnvironment: 'sandbox',
          creemProductIds: '{"pro-monthly":"prod_pro"}',
          locale: 'en',
          defaultLocale: 'en',
        }) as never,
      getPaymentRuntimeBindings: () =>
        ({
          provider: 'creem',
          creemApiKey: 'creem_key',
          creemSigningSecret: 'creem_secret',
        }) as never,
      createPaymentCheckoutSession: async ({ pricingItem }) => {
        onCheckout?.(pricingItem.product_id);
        return {
          checkoutUrl: `https://checkout.example.com/${pricingItem.product_id}`,
          sessionId: 'sess_1',
        };
      },
    })
  );
}

async function postCheckout(handler: (request: Request) => Promise<Response>) {
  return handler(
    new Request('https://example.com/api/payment/checkout', {
      method: 'POST',
    })
  );
}

test('payment checkout route uses site pricing for paid plans', async () => {
  let checkoutProductId = '';
  const handler = createHandler({
    productId: 'pro-monthly',
    onCheckout: (productId) => {
      checkoutProductId = productId;
    },
  });

  const response = await postCheckout(handler);
  const body = (await response.json()) as {
    code: number;
    data: { checkoutUrl: string };
  };

  assert.equal(response.status, 200);
  assert.equal(checkoutProductId, 'pro-monthly');
  assert.equal(
    body.data.checkoutUrl,
    'https://checkout.example.com/pro-monthly'
  );
});

test('payment checkout route rejects free site pricing before auth', async () => {
  let requiredUser = false;
  const handler = createHandler({
    productId: 'free',
    onRequireUser: () => {
      requiredUser = true;
    },
  });

  const response = await postCheckout(handler);
  const body = (await response.json()) as { message: string };

  assert.equal(response.status, 400);
  assert.match(body.message, /not available for checkout/);
  assert.equal(requiredUser, false);
});

test('payment checkout route returns not found for unknown site product', async () => {
  const handler = createHandler({ productId: 'missing' });

  const response = await postCheckout(handler);
  const body = (await response.json()) as { message: string };

  assert.equal(response.status, 404);
  assert.match(body.message, /pricing item not found/);
});
