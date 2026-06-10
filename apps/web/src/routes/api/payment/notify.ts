import {
  handleCheckoutSuccess,
  handleSubscriptionCanceled,
  handleSubscriptionRenewal,
  handleSubscriptionUpdated,
} from '@/domains/billing/application/flows';
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
import { getPaymentRuntimeBindings } from '@/infra/adapters/payment/runtime-bindings';
import { getPaymentService } from '@/infra/adapters/payment/service';
import {
  buildPaymentNotifyPostLogic,
  type PaymentNotifyRouteDeps,
} from '@/server/api/payment/notify-action';
import { createFileRoute } from '@tanstack/react-router';

import { assertPaymentCapabilityEnabled } from '@/config/payment-capability';
import { ServiceUnavailableError } from '@/shared/lib/api/errors';
import { withApi } from '@/shared/lib/api/route';
import { resolveConfigConsistencyMode } from '@/shared/lib/config-consistency';

import { createTanStackApiContext } from '../../../server/api-context';
import { readTanStackBillingRuntimeSettings } from '../../../server/billing-runtime';

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
  readPaymentRuntimeBindings: () => {
    const bindings = getPaymentRuntimeBindings();
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

const postPaymentNotify = withApi(
  buildPaymentNotifyPostLogic(paymentNotifyDeps)
);

export const Route = createFileRoute('/api/payment/notify')({
  server: {
    handlers: {
      POST: ({ request }) => postPaymentNotify(request),
    },
  },
});
