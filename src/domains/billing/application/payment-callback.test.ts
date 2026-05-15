import assert from 'node:assert/strict';
import test from 'node:test';
import type {
  BillingRuntimeSettings,
  PaymentRuntimeBindings,
} from '@/domains/settings/application/settings-runtime.contracts';
import { site } from '@/site';

import {
  confirmPaymentCallbackUseCase,
  resolvePaymentCallbackPricingFallbackUrl,
  resolvePaymentCallbackRedirectQuery,
} from './payment-callback';

function createLog() {
  return {
    debug() {
      return undefined;
    },
    info() {
      return undefined;
    },
    warn() {
      return undefined;
    },
    errorCalls: [] as Array<{ message: string; meta?: unknown }>,
    error(message: string, meta?: unknown) {
      this.errorCalls.push({ message, meta });
    },
  };
}

const BILLING_SETTINGS: BillingRuntimeSettings = {
  locale: '',
  defaultLocale: '',
  provider: 'stripe',
  paymentCapability: 'stripe',
  stripePaymentMethods: '',
};

const PAYMENT_BINDINGS: PaymentRuntimeBindings = {
  provider: 'stripe',
  paymentCapability: 'stripe',
  stripePublishableKey: '',
  stripeSecretKey: '',
  stripeSigningSecret: '',
};

test('resolvePaymentCallbackRedirectQuery 对 not_found/forbidden 回退到 pricing', async () => {
  const log = createLog();

  const notFound = await resolvePaymentCallbackRedirectQuery(
    {
      orderNo: 'order_1',
      actorUserId: 'user_1',
      log,
    },
    {
      readBillingRuntimeSettingsCached: async () => BILLING_SETTINGS,
      findOrderByOrderNo: async () => undefined as never,
    }
  );
  assert.equal(notFound, `${site.brand.appUrl}/pricing`);

  const forbidden = await resolvePaymentCallbackRedirectQuery(
    {
      orderNo: 'order_1',
      actorUserId: 'user_1',
      log,
    },
    {
      readBillingRuntimeSettingsCached: async () => BILLING_SETTINGS,
      findOrderByOrderNo: async () =>
        ({
          orderNo: 'order_1',
          userId: 'other_user',
          paymentType: 'one-time',
        }) as never,
    }
  );
  assert.equal(forbidden, `${site.brand.appUrl}/pricing`);
  assert.equal(log.errorCalls.length >= 2, true);
});

test('resolvePaymentCallbackRedirectQuery 成功返回带 order_no 的 redirectUrl', async () => {
  const result = await resolvePaymentCallbackRedirectQuery(
    {
      orderNo: 'order_1',
      actorUserId: 'user_1',
      log: createLog(),
    },
    {
      readBillingRuntimeSettingsCached: async () => BILLING_SETTINGS,
      findOrderByOrderNo: async () =>
        ({
          orderNo: 'order_1',
          userId: 'user_1',
          paymentType: 'subscription',
          callbackUrl: 'https://app.example.com/return',
        }) as never,
    }
  );

  assert.equal(result, 'https://app.example.com/return?order_no=order_1');
});

test('resolvePaymentCallbackPricingFallbackUrl 返回绝对 pricing fallback url', async () => {
  const result = await resolvePaymentCallbackPricingFallbackUrl({
    readBillingRuntimeSettingsCached: async () => BILLING_SETTINGS,
  });

  assert.equal(result, `${site.brand.appUrl}/pricing`);
});

test('resolvePaymentCallbackPricingFallbackUrl 不再读取 settings/env appUrl fallback', async () => {
  const result = await resolvePaymentCallbackPricingFallbackUrl({
    readBillingRuntimeSettingsCached: async () => BILLING_SETTINGS,
  });

  assert.equal(result, `${site.brand.appUrl}/pricing`);
});

test('resolvePaymentCallbackPricingFallbackUrl 使用 preview runtime app URL', async () => {
  const previousAppUrl = process.env.NEXT_PUBLIC_APP_URL;
  process.env.NEXT_PUBLIC_APP_URL =
    'https://aooi-ai-remover-preview-router.example.workers.dev';

  try {
    const result = await resolvePaymentCallbackPricingFallbackUrl({
      readBillingRuntimeSettingsCached: async () => BILLING_SETTINGS,
    });

    assert.equal(
      result,
      'https://aooi-ai-remover-preview-router.example.workers.dev/pricing'
    );
  } finally {
    if (previousAppUrl === undefined) {
      delete process.env.NEXT_PUBLIC_APP_URL;
    } else {
      process.env.NEXT_PUBLIC_APP_URL = previousAppUrl;
    }
  }
});

test('confirmPaymentCallbackUseCase 覆盖 invalid order 与成功确认支付', async () => {
  await assert.rejects(
    () =>
      confirmPaymentCallbackUseCase(
        {
          orderNo: 'order_1',
          actorUserId: 'user_1',
          actorUserEmail: 'user@example.com',
          log: createLog(),
        },
        {
          readBillingRuntimeSettingsCached: async () => BILLING_SETTINGS,
          readBillingRuntimeSettingsFresh: async () => BILLING_SETTINGS,
          readPaymentRuntimeBindings: () => PAYMENT_BINDINGS,
          findOrderByOrderNo: async () =>
            ({
              orderNo: 'order_1',
              userId: 'user_1',
              paymentType: 'subscription',
            }) as never,
          getPaymentService: async () => {
            throw new Error('should not call payment service');
          },
          handleCheckoutSuccess: async () => {
            throw new Error('should not handle success');
          },
        }
      ),
    /invalid order/
  );

  let handled = 0;

  const result = await confirmPaymentCallbackUseCase(
    {
      orderNo: 'order_1',
      actorUserId: 'user_1',
      actorUserEmail: 'user@example.com',
      log: createLog(),
    },
    {
      readBillingRuntimeSettingsCached: async () => BILLING_SETTINGS,
      readBillingRuntimeSettingsFresh: async () => BILLING_SETTINGS,
      readPaymentRuntimeBindings: () => PAYMENT_BINDINGS,
      findOrderByOrderNo: async () =>
        ({
          orderNo: 'order_1',
          userId: 'user_1',
          paymentType: 'subscription',
          callbackUrl: 'https://app.example.com/return',
          paymentSessionId: 'session_1',
          paymentProvider: 'stripe',
        }) as never,
      getPaymentService: async () =>
        ({
          getPaymentSession: async () =>
            ({
              provider: 'stripe',
              paymentStatus: 'paid',
            }) as never,
        }) as never,
      handleCheckoutSuccess: async () => {
        handled += 1;
        return undefined as never;
      },
    }
  );

  assert.equal(result.orderNo, 'order_1');
  assert.equal(result.redirectUrl, 'https://app.example.com/return');
  assert.equal(handled, 1);
});
