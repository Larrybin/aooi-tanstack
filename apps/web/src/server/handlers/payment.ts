import { createPaymentCheckoutSession } from '@/domains/billing/application/checkout';
import {
  handleCheckoutSuccess,
  handleSubscriptionCanceled,
  handleSubscriptionRenewal,
  handleSubscriptionUpdated,
} from '@/domains/billing/application/flows';
import {
  resolvePaymentCallbackPricingFallbackUrl,
  resolvePaymentCallbackRedirectQuery,
} from '@/domains/billing/application/payment-callback';
import {
  findOrderByInvoiceId,
  findOrderByOrderNo,
  findOrderByTransactionId,
} from '@/domains/billing/infra/order';
import { recordPaymentWebhookAudit } from '@/domains/billing/infra/payment-webhook-audit';
import {
  createPaymentWebhookInboxReceipt,
  markPaymentWebhookInboxAttempt,
  markPaymentWebhookInboxProcessed,
  markPaymentWebhookInboxProcessFailed,
  recordPaymentWebhookInboxCanonicalEvent,
  serializePaymentWebhookHeaders,
} from '@/domains/billing/infra/payment-webhook-inbox';
import { findSubscriptionByProviderSubscriptionId } from '@/domains/billing/infra/subscription';
import { getPaymentService } from '@/infra/adapters/payment/service';
import { getSignedInUserIdentityFromRequest } from '@/infra/platform/auth/session-by-request';
import { getRequestLogger } from '@/infra/platform/logging/request-logger.server';
import { createPaymentCallbackPostAction } from '@/server/api/payment/callback-action';
import { createPaymentCheckoutPostAction } from '@/server/api/payment/checkout-action';
import {
  buildPaymentNotifyPostLogic,
  type PaymentNotifyRouteDeps,
} from '@/server/api/payment/notify-action';
import { sitePricing } from '@/site';

import { assertPaymentCapabilityEnabled } from '@/config/payment-capability';
import { ServiceUnavailableError } from '@/shared/lib/api/errors';
import { withApi } from '@/shared/lib/api/route';
import { resolveConfigConsistencyMode } from '@/shared/lib/config-consistency';
import { PaymentCallbackQuerySchema } from '@/shared/schemas/api/payment/callback';

import { createTanStackApiContext } from '../api-context';
import {
  readTanStackBillingRuntimeSettings,
  readTanStackPaymentRuntimeBindings,
} from '../billing-runtime';
import { withTanStackCloudflareBindings } from '../cloudflare-bindings';

export const postPaymentCheckout = withTanStackCloudflareBindings(
  withApi(
    createPaymentCheckoutPostAction({
      requirePaymentCapability: assertPaymentCapabilityEnabled,
      createApiContext: createTanStackApiContext,
      sitePricing,
      readBillingRuntimeSettings: readTanStackBillingRuntimeSettings,
      getPaymentRuntimeBindings: readTanStackPaymentRuntimeBindings,
      createPaymentCheckoutSession,
    })
  )
);

export const postPaymentCallback = withTanStackCloudflareBindings(
  withApi(
    createPaymentCallbackPostAction({
      requirePaymentCapability: assertPaymentCapabilityEnabled,
      createApiContext: createTanStackApiContext,
      findOrderByOrderNo,
      readBillingRuntimeSettingsCached: readTanStackBillingRuntimeSettings,
      readBillingRuntimeSettingsFresh: readTanStackBillingRuntimeSettings,
      getPaymentRuntimeBindings: readTanStackPaymentRuntimeBindings,
      createPaymentService: async ({ settings, bindings }) =>
        await getPaymentService({ settings, bindings }),
      handleCheckoutSuccess,
      resolveMode: resolveConfigConsistencyMode,
    })
  )
);

export const getPaymentCallback = withTanStackCloudflareBindings(
  async (request: Request) => {
    assertPaymentCapabilityEnabled();
    const { log } = getRequestLogger(request);
    let redirectUrl: string;

    try {
      const parsedQuery = PaymentCallbackQuerySchema.parse(
        Object.fromEntries(new URL(request.url).searchParams)
      );
      const user = await getSignedInUserIdentityFromRequest(request);
      if (!user) {
        throw new Error('payment callback requires a signed-in user');
      }
      redirectUrl = await resolvePaymentCallbackRedirectQuery(
        {
          orderNo: parsedQuery.order_no,
          actorUserId: user.id,
          log,
        },
        {
          readBillingRuntimeSettingsCached: readTanStackBillingRuntimeSettings,
          findOrderByOrderNo,
        }
      );
    } catch (error) {
      log.error('payment: callback get fallback to pricing', { error });
      redirectUrl = await resolvePaymentCallbackPricingFallbackUrl({
        readBillingRuntimeSettingsCached: readTanStackBillingRuntimeSettings,
      });
    }

    return Response.redirect(redirectUrl, 307);
  }
);

const paymentNotifyDeps: PaymentNotifyRouteDeps = {
  createApiContext: createTanStackApiContext,
  requirePaymentCapability: assertPaymentCapabilityEnabled,
  findOrderByInvoiceId,
  findOrderByOrderNo,
  findOrderByTransactionId,
  findSubscriptionByProviderSubscriptionId,
  recordUnknownWebhookEvent: recordPaymentWebhookAudit,
  handleCheckoutSuccess,
  handleSubscriptionCanceled,
  handleSubscriptionRenewal,
  handleSubscriptionUpdated,
  createPaymentWebhookInboxReceipt,
  recordPaymentWebhookInboxCanonicalEvent,
  markPaymentWebhookInboxAttempt,
  markPaymentWebhookInboxProcessFailed,
  markPaymentWebhookInboxProcessed,
  serializePaymentWebhookHeaders,
  resolveConfigConsistencyMode,
  readBillingRuntimeSettingsCached: readTanStackBillingRuntimeSettings,
  readBillingRuntimeSettingsFresh: readTanStackBillingRuntimeSettings,
  readPaymentRuntimeBindings: async () => {
    const bindings = await readTanStackPaymentRuntimeBindings();
    if (bindings.provider === 'none') {
      throw new ServiceUnavailableError(
        'payment notify bindings cannot be resolved for payment=none'
      );
    }
    return bindings;
  },
  createPaymentService: async ({ settings, bindings }) =>
    await getPaymentService({ settings, bindings }),
  now: () => new Date(),
};

export const postPaymentNotify = withTanStackCloudflareBindings(
  withApi(buildPaymentNotifyPostLogic(paymentNotifyDeps))
);
