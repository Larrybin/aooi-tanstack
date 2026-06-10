import { redirect } from 'next/navigation';
import { requirePaymentCapability } from '@/app/api/payment/_lib/guard';
import {
  confirmPaymentCallbackUseCase,
  resolvePaymentCallbackPricingFallbackUrl,
  resolvePaymentCallbackRedirectQuery,
} from '@/domains/billing/application/payment-callback';

import { jsonOk } from '@/shared/lib/api/response';
import { resolveConfigConsistencyMode } from '@/shared/lib/config-consistency';
import {
  PaymentCallbackBodySchema,
  PaymentCallbackQuerySchema,
} from '@/shared/schemas/api/payment/callback';

type LogLike = {
  debug(message: string, meta?: unknown): void;
  info(message: string, meta?: unknown): void;
  warn(message: string, meta?: unknown): void;
  error(message: string, meta?: unknown): void;
};

type PaymentCallbackGetApiContext = {
  log: LogLike;
  parseQuery: (schema: typeof PaymentCallbackQuerySchema) => {
    order_no: string;
  };
  requireUser: () => Promise<{ id: string }>;
};

type PaymentCallbackPostApiContext = {
  log: LogLike;
  parseJson: (schema: typeof PaymentCallbackBodySchema) => Promise<{
    order_no: string;
  }>;
  requireUser: () => Promise<{ id: string; email?: string | null }>;
};

export function buildPaymentCallbackGetHandler(deps: {
  createApiContext: (req: Request) => PaymentCallbackGetApiContext;
  resolveRedirectQuery?: typeof resolvePaymentCallbackRedirectQuery;
  resolvePricingFallbackUrl?: typeof resolvePaymentCallbackPricingFallbackUrl;
  requirePaymentCapability?: () => void;
}) {
  const resolveRedirectQuery =
    deps.resolveRedirectQuery ?? resolvePaymentCallbackRedirectQuery;
  const resolvePricingFallbackUrl =
    deps.resolvePricingFallbackUrl ?? resolvePaymentCallbackPricingFallbackUrl;
  const ensurePaymentCapability =
    deps.requirePaymentCapability ?? requirePaymentCapability;

  return async (req: Request) => {
    ensurePaymentCapability();
    const api = deps.createApiContext(req);
    const { log } = api;
    let redirectUrl: string;

    try {
      const { order_no: orderNo } = api.parseQuery(PaymentCallbackQuerySchema);
      const user = await api.requireUser();
      redirectUrl = await resolveRedirectQuery({
        orderNo,
        actorUserId: user.id,
        log,
      });
    } catch (error: unknown) {
      log.error('payment: callback get fallback to pricing', { error });
      redirectUrl = await resolvePricingFallbackUrl();
    }

    redirect(redirectUrl);
  };
}

export function buildPaymentCallbackPostAction(deps: {
  createApiContext: (req: Request) => PaymentCallbackPostApiContext;
  confirmUseCase?: typeof confirmPaymentCallbackUseCase;
  resolveMode?: typeof resolveConfigConsistencyMode;
  requirePaymentCapability?: () => void;
}) {
  const confirmUseCase = deps.confirmUseCase ?? confirmPaymentCallbackUseCase;
  const resolveMode = deps.resolveMode ?? resolveConfigConsistencyMode;
  const ensurePaymentCapability =
    deps.requirePaymentCapability ?? requirePaymentCapability;

  return async (req: Request) => {
    ensurePaymentCapability();
    const api = deps.createApiContext(req);
    const { log } = api;
    const { order_no: orderNo } = await api.parseJson(
      PaymentCallbackBodySchema
    );
    const user = await api.requireUser();

    const mode = resolveMode(req);
    const result = await confirmUseCase({
      orderNo,
      actorUserId: user.id,
      actorUserEmail: user.email,
      mode,
      log,
    });

    return jsonOk(result);
  };
}
