import {
  handlePaymentNotifyRequest,
  type PaymentNotifyFlowDeps,
} from '@/domains/billing/application/payment-notify-flow';
import type { PaymentNotifyDeps } from '@/domains/billing/application/process-payment-notify';
import type {
  ActiveBillingRuntimeSettings,
  ActivePaymentRuntimeBindings,
} from '@/domains/settings/application/settings-runtime.contracts';
import type { PaymentService } from '@/infra/adapters/payment/service';

type LogLike = {
  debug: (message: string, meta?: Record<string, unknown>) => void;
  info: (message: string, meta?: Record<string, unknown>) => void;
  warn: (message: string, meta?: Record<string, unknown>) => void;
  error: (message: string, meta?: Record<string, unknown>) => void;
};

type PaymentNotifyRouteApiContext = {
  log: LogLike;
};

export type PaymentNotifyRouteDeps = PaymentNotifyDeps & {
  createApiContext: (req: Request) => PaymentNotifyRouteApiContext;
  requirePaymentCapability: () => ActiveBillingRuntimeSettings['provider'];
  createPaymentWebhookInboxReceipt: PaymentNotifyFlowDeps['createPaymentWebhookInboxReceipt'];
  recordPaymentWebhookInboxCanonicalEvent: PaymentNotifyFlowDeps['recordPaymentWebhookInboxCanonicalEvent'];
  markPaymentWebhookInboxAttempt: PaymentNotifyFlowDeps['markPaymentWebhookInboxAttempt'];
  markPaymentWebhookInboxProcessFailed: PaymentNotifyFlowDeps['markPaymentWebhookInboxProcessFailed'];
  markPaymentWebhookInboxProcessed: PaymentNotifyFlowDeps['markPaymentWebhookInboxProcessed'];
  serializePaymentWebhookHeaders: PaymentNotifyFlowDeps['serializePaymentWebhookHeaders'];
  resolveConfigConsistencyMode: (req: Request) => 'cached' | 'fresh';
  readBillingRuntimeSettingsCached: () => Promise<
    ActiveBillingRuntimeSettings | BillingRuntimeSettingsForNone
  >;
  readBillingRuntimeSettingsFresh: () => Promise<
    ActiveBillingRuntimeSettings | BillingRuntimeSettingsForNone
  >;
  readPaymentRuntimeBindings: () =>
    | ActivePaymentRuntimeBindings
    | Promise<ActivePaymentRuntimeBindings>;
  createPaymentService: (input: {
    settings: ActiveBillingRuntimeSettings;
    bindings: ActivePaymentRuntimeBindings;
  }) => Promise<PaymentService>;
  now: () => Date;
};

type BillingRuntimeSettingsForNone = {
  provider: 'none';
};

export function buildPaymentNotifyPostLogic(deps: PaymentNotifyRouteDeps) {
  return async (req: Request) => {
    const provider = deps.requirePaymentCapability();
    const api = deps.createApiContext(req);
    const { log } = api;
    const mode = deps.resolveConfigConsistencyMode(req);
    const settings =
      mode === 'fresh'
        ? await deps.readBillingRuntimeSettingsFresh()
        : await deps.readBillingRuntimeSettingsCached();
    if (settings.provider === 'none') {
      throw new Error(
        'payment notify settings cannot be resolved for payment=none'
      );
    }

    const bindings = await deps.readPaymentRuntimeBindings();
    const paymentService = await deps.createPaymentService({
      settings: settings as ActiveBillingRuntimeSettings,
      bindings,
    });

    const flowDeps: PaymentNotifyFlowDeps = {
      ...deps,
      getPaymentEvent: (inputReq) =>
        paymentService.getPaymentEvent({
          req: inputReq,
        }),
      onProcessFailure: ({ provider: failedProvider, inboxId, error }) => {
        log.error('payment: webhook inbox process failed', {
          operation: 'process-webhook-inbox',
          provider: failedProvider,
          inboxId,
          error,
        });
      },
    };

    return handlePaymentNotifyRequest({
      provider,
      req,
      log,
      deps: flowDeps,
    });
  };
}
