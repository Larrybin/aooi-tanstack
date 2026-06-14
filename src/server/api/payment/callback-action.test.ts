import assert from 'node:assert/strict';
import test from 'node:test';

import { createPaymentCallbackPostAction } from './callback-action';

test('createPaymentCallbackPostAction confirms signed-in payment callback', async () => {
  let requiredCapability = false;
  let freshSettingsReads = 0;
  let handled = 0;

  const action = createPaymentCallbackPostAction({
    requirePaymentCapability: () => {
      requiredCapability = true;
    },
    createApiContext: () => ({
      log: {
        debug() {},
        info() {},
        warn() {},
        error() {},
      },
      parseJson: async () => ({ order_no: 'order-1' }),
      requireUser: async () => ({
        id: 'user-1',
        email: 'ada@example.test',
      }),
    }),
    resolveMode: () => 'fresh',
    findOrderByOrderNo: async () =>
      ({
        orderNo: 'order-1',
        userId: 'user-1',
        paymentType: 'subscription',
        callbackUrl: '/settings/billing',
        paymentSessionId: 'session-1',
        paymentProvider: 'stripe',
      }) as never,
    readBillingRuntimeSettingsCached: async () => {
      throw new Error('should read fresh settings');
    },
    readBillingRuntimeSettingsFresh: async () => {
      freshSettingsReads += 1;
      return { provider: 'stripe' };
    },
    getPaymentRuntimeBindings: () => ({ provider: 'stripe' }),
    createPaymentService: async () => ({
      getPaymentSession: async () => ({ provider: 'stripe' }) as never,
    }),
    handleCheckoutSuccess: async () => {
      handled += 1;
    },
  });

  const response = await action(new Request('https://example.test/callback'));
  const body = (await response.json()) as {
    data: { orderNo: string; redirectUrl: string };
  };

  assert.equal(requiredCapability, true);
  assert.deepEqual(body.data, {
    orderNo: 'order-1',
    redirectUrl: '/settings/billing',
  });
  assert.equal(freshSettingsReads, 1);
  assert.equal(handled, 1);
});
