import {
  PaymentType,
  type PaymentSession,
} from '@/domains/billing/domain/payment';
import type { Order } from '@/domains/billing/infra/order';
import { getRuntimeEnvString } from '@/infra/runtime/env.server';

import { resolveRuntimeAppUrl } from '@/config/runtime-app-url';
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
} from '@/shared/lib/api/errors';
import { assertPaymentCapabilityEnabled } from '@/config/payment-capability';
import { jsonOk } from '@/shared/lib/api/response';
import {
  resolveConfigConsistencyMode,
  type ConfigConsistencyMode,
} from '@/shared/lib/config-consistency';
import { PaymentCallbackBodySchema } from '@/shared/schemas/api/payment/callback';

type PaymentCallbackApiContext = {
  log: {
    debug(message: string, meta?: unknown): void;
    info(message: string, meta?: unknown): void;
    warn(message: string, meta?: unknown): void;
    error(message: string, meta?: unknown): void;
  };
  parseJson(schema: typeof PaymentCallbackBodySchema): Promise<{
    order_no: string;
  }>;
  requireUser(): Promise<{
    id: string;
    email?: string | null;
  }>;
};

type PaymentCallbackService = {
  getPaymentSession(input: { sessionId: string }): Promise<PaymentSession>;
};

type PaymentCallbackPostActionDeps<TSettings, TBindings> = {
  createApiContext: (req: Request) => PaymentCallbackApiContext;
  findOrderByOrderNo(orderNo: string): Promise<Order | undefined>;
  readBillingRuntimeSettingsCached(): Promise<TSettings>;
  readBillingRuntimeSettingsFresh(): Promise<TSettings>;
  getPaymentRuntimeBindings(): TBindings | Promise<TBindings>;
  createPaymentService(input: {
    settings: TSettings;
    bindings: TBindings;
  }): Promise<PaymentCallbackService>;
  handleCheckoutSuccess(input: {
    order: Order;
    session: PaymentSession;
    log: PaymentCallbackApiContext['log'];
  }): Promise<unknown>;
  resolveMode?: (req: Request) => ConfigConsistencyMode;
  requirePaymentCapability?: () => void;
};

export function createPaymentCallbackPostAction<TSettings, TBindings>(
  deps: PaymentCallbackPostActionDeps<TSettings, TBindings>
) {
  const resolveMode = deps.resolveMode ?? resolveConfigConsistencyMode;
  const requirePaymentCapability =
    deps.requirePaymentCapability ?? assertPaymentCapabilityEnabled;

  return async (req: Request) => {
    requirePaymentCapability();
    const api = deps.createApiContext(req);
    const { order_no: orderNo } = await api.parseJson(
      PaymentCallbackBodySchema
    );
    const user = await api.requireUser();

    if (!user.email) {
      throw new UnauthorizedError('no auth, please sign in');
    }

    const order = await deps.findOrderByOrderNo(orderNo);
    assertOrderVisibleToActor(order, user.id);

    if (!order.paymentSessionId || !order.paymentProvider) {
      throw new BadRequestError('invalid order');
    }

    const mode = resolveMode(req);
    const [settings, bindings] = await Promise.all([
      mode === 'fresh'
        ? deps.readBillingRuntimeSettingsFresh()
        : deps.readBillingRuntimeSettingsCached(),
      Promise.resolve(deps.getPaymentRuntimeBindings()),
    ]);
    const paymentService = await deps.createPaymentService({
      settings,
      bindings,
    });
    const session = await paymentService.getPaymentSession({
      sessionId: order.paymentSessionId,
    });

    await deps.handleCheckoutSuccess({
      order,
      session,
      log: api.log,
    });

    return jsonOk({
      orderNo,
      redirectUrl:
        order.callbackUrl || toPaymentFallbackUrl(order.paymentType),
    });
  };
}

function assertOrderVisibleToActor(
  order: Order | undefined,
  actorUserId: string
): asserts order is Order {
  if (!order) {
    throw new NotFoundError('order not found');
  }
  if (order.userId !== actorUserId) {
    throw new ForbiddenError('no permission');
  }
}

function toPaymentFallbackUrl(type: string | null | undefined): string {
  const appUrl = resolveRuntimeAppUrl({
    NEXT_PUBLIC_APP_URL: getRuntimeEnvString('NEXT_PUBLIC_APP_URL'),
  });
  return type === PaymentType.SUBSCRIPTION
    ? `${appUrl}/settings/billing`
    : `${appUrl}/settings/payments`;
}
