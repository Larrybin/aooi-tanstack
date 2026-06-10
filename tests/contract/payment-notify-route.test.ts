import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PaymentEventType,
  WebhookPayloadError,
  WebhookVerificationError,
  type PaymentEvent,
} from '@/domains/billing/domain/payment';
import {
  buildPaymentNotifyPostLogic,
  type PaymentNotifyRouteDeps,
} from '@/server/api/payment/notify-action';
import { site } from '@/site';

function createRequest() {
  return new Request('https://example.com/api/payment/notify', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-request-id': 'req_payment_notify_route',
    },
    body: '{"event":"test"}',
  });
}

type PaymentCapability = 'none' | 'stripe' | 'creem' | 'paypal';

function createUnknownEvent(
  provider: 'stripe' | 'creem' | 'paypal'
): PaymentEvent {
  return {
    eventType: PaymentEventType.UNKNOWN,
    eventResult: { event: 'unknown' },
    paymentSession: {
      provider,
      metadata: {
        event_id: 'evt_1',
        event_type: 'UNKNOWN',
      },
    },
  };
}

function createRouteHandler(overrides: Partial<PaymentNotifyRouteDeps> = {}) {
  return buildPaymentNotifyPostLogic({
    createApiContext: () => ({
      log: {
        debug: () => undefined,
        info: () => undefined,
        warn: () => undefined,
        error: () => undefined,
      },
    }),
    requirePaymentCapability: () => {
      const capability = site.capabilities.payment;
      if (capability === 'none') {
        throw new Error('requirePaymentCapability override required');
      }
      return capability as Exclude<PaymentCapability, 'none'>;
    },
    readBillingRuntimeSettingsCached: async () => ({
      provider: 'stripe',
      paymentCapability: 'stripe',
      locale: 'en',
      defaultLocale: 'en',
      stripePaymentMethods: 'card',
    }),
    readBillingRuntimeSettingsFresh: async () => ({
      provider: 'stripe',
      paymentCapability: 'stripe',
      locale: 'en',
      defaultLocale: 'en',
      stripePaymentMethods: 'card',
    }),
    readPaymentRuntimeBindings: () => ({
      provider: 'stripe',
      paymentCapability: 'stripe',
      stripePublishableKey: 'pk_test',
      stripeSecretKey: 'sk_test',
      stripeSigningSecret: 'whsec_test',
    }),
    createPaymentService: async () => ({
      getProvider: () => undefined,
      getDefaultProvider: () => {
        throw new Error('not needed in route contract test');
      },
      createPayment: async () => {
        throw new Error('not needed in route contract test');
      },
      getPaymentSession: async () => {
        throw new Error('not needed in route contract test');
      },
      getPaymentEvent: async () => createUnknownEvent('stripe'),
    }),
    createPaymentWebhookInboxReceipt: async () => ({
      record: { id: 'inbox_1', status: 'received' },
      isNew: true,
    }),
    recordPaymentWebhookInboxCanonicalEvent: async () => undefined,
    markPaymentWebhookInboxAttempt: async () => undefined,
    markPaymentWebhookInboxProcessFailed: async () => undefined,
    markPaymentWebhookInboxProcessed: async () => undefined,
    serializePaymentWebhookHeaders: (headers: Headers) =>
      JSON.stringify(Object.fromEntries(headers.entries())),
    resolveConfigConsistencyMode: () => 'cached',
    findOrderByInvoiceId: async () => null,
    findOrderByOrderNo: async () => null,
    findOrderByTransactionId: async () => null,
    findSubscriptionByProviderSubscriptionId: async () => null,
    recordUnknownWebhookEvent: async () => undefined,
    handleCheckoutSuccess: async () => undefined,
    handleSubscriptionCanceled: async () => undefined,
    handleSubscriptionRenewal: async () => undefined,
    handleSubscriptionUpdated: async () => undefined,
    now: () => new Date('2026-04-24T10:00:00.000Z'),
    ...overrides,
  });
}

async function withPaymentCapability<T>(
  capability: PaymentCapability,
  run: () => Promise<T>
): Promise<T> {
  const originalCapability = site.capabilities.payment;
  const mutableCapabilities = site.capabilities as {
    payment: PaymentCapability;
  };
  mutableCapabilities.payment = capability;
  try {
    return await run();
  } finally {
    mutableCapabilities.payment = originalCapability;
  }
}

test('payment notify route: payment=none 时直接 404，且不会读取 settings/bindings/service', async () => {
  await withPaymentCapability('none', async () => {
    const { NotFoundError } = await import('@/shared/lib/api/errors');
    const { withApi } = await import('@/shared/lib/api/route');
    let settingsRead = false;
    let bindingsRead = false;
    let serviceCreated = false;

    const handler = withApi(
      createRouteHandler({
        requirePaymentCapability: () => {
          throw new NotFoundError('not found', undefined, {
            internalMeta: { reason: 'capability_disabled' },
          });
        },
        readBillingRuntimeSettingsCached: async () => {
          settingsRead = true;
          throw new Error('should not read settings');
        },
        readBillingRuntimeSettingsFresh: async () => {
          settingsRead = true;
          throw new Error('should not read fresh settings');
        },
        readPaymentRuntimeBindings: () => {
          bindingsRead = true;
          throw new Error('should not read bindings');
        },
        createPaymentService: async () => {
          serviceCreated = true;
          throw new Error('should not create service');
        },
      })
    );

    const response = await handler(createRequest());
    const body = (await response.json()) as Record<string, unknown>;

    assert.equal(response.status, 404);
    assert.equal(body.message, 'not found');
    assert.equal('reason' in body, false);
    assert.equal('internalMeta' in body, false);
    assert.equal(settingsRead, false);
    assert.equal(bindingsRead, false);
    assert.equal(serviceCreated, false);
  });
});

test('payment notify route: capability_disabled internalMeta 写日志但不写响应', async () => {
  const logs: Array<{ message: string; meta?: unknown }> = [];
  const originalConsoleInfo = console.info;
  console.info = ((message: string, meta?: unknown) => {
    logs.push({ message, meta });
  }) as typeof console.info;

  try {
    await withPaymentCapability('none', async () => {
      const { NotFoundError } = await import('@/shared/lib/api/errors');
      const { withApi } = await import('@/shared/lib/api/route');
      const handler = withApi(
        createRouteHandler({
          requirePaymentCapability: () => {
            throw new NotFoundError('not found', undefined, {
              internalMeta: { reason: 'capability_disabled' },
            });
          },
        })
      );
      const response = await handler(createRequest());
      const body = (await response.json()) as Record<string, unknown>;

      assert.equal(response.status, 404);
      assert.equal('reason' in body, false);
      assert.equal('internalMeta' in body, false);
    });

    assert.equal(
      logs.some(
        (entry) =>
          entry.message === '[api] handled business error' &&
          JSON.stringify(entry.meta).includes('capability_disabled')
      ),
      true
    );
  } finally {
    console.info = originalConsoleInfo;
  }
});

test('payment notify route: 验签失败返回 401，不回落成 404', async () => {
  await withPaymentCapability('stripe', async () => {
    const { withApi } = await import('@/shared/lib/api/route');
    const handler = withApi(
      createRouteHandler({
        createPaymentService: async () => ({
          getProvider: () => undefined,
          getDefaultProvider: () => {
            throw new Error('not needed in route contract test');
          },
          createPayment: async () => {
            throw new Error('not needed in route contract test');
          },
          getPaymentSession: async () => {
            throw new Error('not needed in route contract test');
          },
          getPaymentEvent: async () => {
            throw new WebhookVerificationError('invalid webhook signature');
          },
        }),
      })
    );

    const response = await handler(createRequest());
    const body = (await response.json()) as Record<string, unknown>;

    assert.equal(response.status, 401);
    assert.equal(body.message, 'invalid webhook signature');
  });
});

test('payment notify route: payload 非法返回 400，不回落成 404', async () => {
  await withPaymentCapability('stripe', async () => {
    const { withApi } = await import('@/shared/lib/api/route');
    const handler = withApi(
      createRouteHandler({
        createPaymentService: async () => ({
          getProvider: () => undefined,
          getDefaultProvider: () => {
            throw new Error('not needed in route contract test');
          },
          createPayment: async () => {
            throw new Error('not needed in route contract test');
          },
          getPaymentSession: async () => {
            throw new Error('not needed in route contract test');
          },
          getPaymentEvent: async () => {
            throw new WebhookPayloadError('invalid webhook payload');
          },
        }),
      })
    );

    const response = await handler(createRequest());
    const body = (await response.json()) as Record<string, unknown>;

    assert.equal(response.status, 400);
    assert.equal(body.message, 'invalid webhook payload');
  });
});

test('payment notify route: provider-specific 配置失败返回 503，不回落成 404', async () => {
  await withPaymentCapability('stripe', async () => {
    const { ServiceUnavailableError } = await import('@/shared/lib/api/errors');
    const { withApi } = await import('@/shared/lib/api/route');
    const handler = withApi(
      createRouteHandler({
        createPaymentService: async () => ({
          getProvider: () => undefined,
          getDefaultProvider: () => {
            throw new Error('not needed in route contract test');
          },
          createPayment: async () => {
            throw new Error('not needed in route contract test');
          },
          getPaymentSession: async () => {
            throw new Error('not needed in route contract test');
          },
          getPaymentEvent: async () => {
            throw new ServiceUnavailableError(
              'signing secret not configured',
              undefined,
              {
                internalMeta: {
                  reason: 'misconfigured_provider',
                  provider: 'stripe',
                },
              }
            );
          },
        }),
      })
    );

    const response = await handler(createRequest());
    const body = (await response.json()) as Record<string, unknown>;

    assert.equal(response.status, 503);
    assert.equal(body.message, 'signing secret not configured');
  });
});

test('payment notify route: provider 严格来自 site capability，而不是 URL', async () => {
  let observedProvider = '';

  await withPaymentCapability('paypal', async () => {
    const { withApi } = await import('@/shared/lib/api/route');
    const handler = withApi(
      createRouteHandler({
        readBillingRuntimeSettingsCached: async () => ({
          provider: 'paypal',
          paymentCapability: 'paypal',
          locale: 'en',
          defaultLocale: 'en',
          paypalEnvironment: 'sandbox',
        }),
        readBillingRuntimeSettingsFresh: async () => ({
          provider: 'paypal',
          paymentCapability: 'paypal',
          locale: 'en',
          defaultLocale: 'en',
          paypalEnvironment: 'sandbox',
        }),
        readPaymentRuntimeBindings: () => ({
          provider: 'paypal',
          paymentCapability: 'paypal',
          paypalClientId: 'client',
          paypalClientSecret: 'secret',
          paypalWebhookId: 'wh_123',
        }),
        createPaymentService: async () => ({
          getProvider: () => undefined,
          getDefaultProvider: () => {
            throw new Error('not needed in route contract test');
          },
          createPayment: async () => {
            throw new Error('not needed in route contract test');
          },
          getPaymentSession: async () => {
            throw new Error('not needed in route contract test');
          },
          getPaymentEvent: async () => createUnknownEvent('paypal'),
        }),
        recordUnknownWebhookEvent: async ({ provider }) => {
          observedProvider = provider;
        },
      })
    );

    const response = await handler(createRequest());
    const body = (await response.json()) as Record<string, unknown>;

    assert.equal(response.status, 200);
    assert.equal(body.message, 'ok');
    assert.equal(observedProvider, 'paypal');
  });
});
