import {
  handleCheckoutSuccess,
  handleSubscriptionCanceled,
  handleSubscriptionRenewal,
  handleSubscriptionUpdated,
} from '@/domains/billing/application/flows';
import {
  handlePaymentNotifyRequest,
  type PaymentNotifyFlowDeps,
} from '@/domains/billing/application/payment-notify-flow';
import type { PaymentNotifyDeps } from '@/domains/billing/application/process-payment-notify';
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
import type {
  ActiveBillingRuntimeSettings,
  ActivePaymentRuntimeBindings,
} from '@/domains/settings/application/settings-runtime.contracts';
import {
  readBillingRuntimeSettingsCached,
  readBillingRuntimeSettingsFresh,
} from '@/domains/settings/application/settings-runtime.query';
import { getPaymentRuntimeBindings } from '@/infra/adapters/payment/runtime-bindings';
import {
  getPaymentService,
  type PaymentService,
} from '@/infra/adapters/payment/service';
import { createFileRoute } from '@tanstack/react-router';

import { assertPaymentCapabilityEnabled } from '@/config/payment-capability';
import { ServiceUnavailableError } from '@/shared/lib/api/errors';
import { withApi } from '@/shared/lib/api/route';
import { resolveConfigConsistencyMode } from '@/shared/lib/config-consistency';

import { createTanStackApiContext } from '../../../server/api-context';

type BillingRuntimeSettingsForNone = {
  provider: 'none';
};

type PaymentNotifyRouteDeps = PaymentNotifyDeps & {
  createPaymentWebhookInboxReceipt: PaymentNotifyFlowDeps['createPaymentWebhookInboxReceipt'];
  recordPaymentWebhookInboxCanonicalEvent: PaymentNotifyFlowDeps['recordPaymentWebhookInboxCanonicalEvent'];
  markPaymentWebhookInboxAttempt: PaymentNotifyFlowDeps['markPaymentWebhookInboxAttempt'];
  markPaymentWebhookInboxProcessFailed: PaymentNotifyFlowDeps['markPaymentWebhookInboxProcessFailed'];
  markPaymentWebhookInboxProcessed: PaymentNotifyFlowDeps['markPaymentWebhookInboxProcessed'];
  serializePaymentWebhookHeaders: PaymentNotifyFlowDeps['serializePaymentWebhookHeaders'];
  readBillingRuntimeSettingsCached: () => Promise<
    ActiveBillingRuntimeSettings | BillingRuntimeSettingsForNone
  >;
  readBillingRuntimeSettingsFresh: () => Promise<
    ActiveBillingRuntimeSettings | BillingRuntimeSettingsForNone
  >;
  readPaymentRuntimeBindings: () => ActivePaymentRuntimeBindings;
  createPaymentService: (input: {
    settings: ActiveBillingRuntimeSettings;
    bindings: ActivePaymentRuntimeBindings;
  }) => Promise<PaymentService>;
  now: PaymentNotifyFlowDeps['now'];
};

const paymentNotifyDeps: PaymentNotifyRouteDeps = {
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
    await getPaymentService({ settings, bindings }),
  now: () => new Date(),
};

const postPaymentNotify = withApi(async (request: Request) => {
  const provider = assertPaymentCapabilityEnabled();
  const api = createTanStackApiContext(request);
  const mode = resolveConfigConsistencyMode(request);
  const settings =
    mode === 'fresh'
      ? await paymentNotifyDeps.readBillingRuntimeSettingsFresh()
      : await paymentNotifyDeps.readBillingRuntimeSettingsCached();

  if (settings.provider === 'none') {
    throw new Error(
      'payment notify settings cannot be resolved for payment=none'
    );
  }

  const bindings = paymentNotifyDeps.readPaymentRuntimeBindings();
  const paymentService = await paymentNotifyDeps.createPaymentService({
    settings: settings as ActiveBillingRuntimeSettings,
    bindings,
  });

  const flowDeps: PaymentNotifyFlowDeps = {
    ...paymentNotifyDeps,
    getPaymentEvent: (inputReq) =>
      paymentService.getPaymentEvent({
        req: inputReq,
      }),
    onProcessFailure: ({ provider: failedProvider, inboxId, error }) => {
      api.log.error('payment: webhook inbox process failed', {
        operation: 'process-webhook-inbox',
        provider: failedProvider,
        inboxId,
        error,
      });
    },
  };

  return handlePaymentNotifyRequest({
    provider,
    req: request,
    log: api.log,
    deps: flowDeps,
  });
});

export const Route = createFileRoute('/api/payment/notify')({
  server: {
    handlers: {
      POST: ({ request }) => postPaymentNotify(request),
    },
  },
});
