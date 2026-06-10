import { createApiContext } from '@/app/api/_lib/context';
import { requirePaymentCapability } from '@/app/api/payment/_lib/guard';
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
import {
  readBillingRuntimeSettingsCached,
  readBillingRuntimeSettingsFresh,
} from '@/domains/settings/application/settings-runtime.query';
import { getPaymentRuntimeBindings } from '@/infra/adapters/payment/runtime-bindings';
import { getPaymentService } from '@/infra/adapters/payment/service';
import {
  buildPaymentNotifyPostLogic,
  type PaymentNotifyRouteDeps,
} from '@/server/api/payment/notify-action';

import { ServiceUnavailableError } from '@/shared/lib/api/errors';
import { withApi } from '@/shared/lib/api/route';
import { resolveConfigConsistencyMode } from '@/shared/lib/config-consistency';

const routeDeps: PaymentNotifyRouteDeps = {
  createApiContext,
  requirePaymentCapability,
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
  readBillingRuntimeSettingsCached,
  readBillingRuntimeSettingsFresh,
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
    await getPaymentService({
      settings,
      bindings,
    }),
  now: () => new Date(),
};

export function createPaymentNotifyPostHandler(
  overrides: Partial<PaymentNotifyRouteDeps> = {}
) {
  return withApi(
    buildPaymentNotifyPostLogic({
      ...routeDeps,
      ...overrides,
    })
  );
}

export const POST = withApi(buildPaymentNotifyPostLogic(routeDeps));
