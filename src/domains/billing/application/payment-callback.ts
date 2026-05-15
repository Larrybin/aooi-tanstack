import type { handleCheckoutSuccess } from '@/domains/billing/application/flows';
import {
  PaymentType,
  type PaymentSession,
} from '@/domains/billing/domain/payment';
import type { findOrderByOrderNo, Order } from '@/domains/billing/infra/order';
import type { PaymentRuntimeBindings } from '@/domains/settings/application/settings-runtime.contracts';
import type {
  readBillingRuntimeSettingsCached,
  readBillingRuntimeSettingsFresh,
} from '@/domains/settings/application/settings-runtime.query';
import type { getPaymentService } from '@/infra/adapters/payment/service';
import { getRuntimeEnvString } from '@/infra/runtime/env.server';

import { resolveRuntimeAppUrl } from '@/config/runtime-app-url';
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
} from '@/shared/lib/api/errors';

type BillingCallbackLog = {
  debug(message: string, meta?: unknown): void;
  info(message: string, meta?: unknown): void;
  warn(message: string, meta?: unknown): void;
  error(message: string, meta?: unknown): void;
};

type PaymentCallbackDeps = {
  readBillingRuntimeSettingsCached: typeof readBillingRuntimeSettingsCached;
  readBillingRuntimeSettingsFresh: typeof readBillingRuntimeSettingsFresh;
  readPaymentRuntimeBindings: () => PaymentRuntimeBindings;
  findOrderByOrderNo: typeof findOrderByOrderNo;
  getPaymentService: typeof getPaymentService;
  handleCheckoutSuccess: typeof handleCheckoutSuccess;
};

export async function resolvePaymentCallbackRedirectQuery(
  input: {
    orderNo: string;
    actorUserId: string;
    log: BillingCallbackLog;
  },
  deps?: Pick<
    PaymentCallbackDeps,
    'readBillingRuntimeSettingsCached' | 'findOrderByOrderNo'
  >
) {
  const resolvedDeps = deps ?? (await getPaymentCallbackReadDeps());
  const appUrl = await resolveAppUrl(resolvedDeps);

  try {
    const order = await resolvedDeps.findOrderByOrderNo(input.orderNo);
    assertOrderVisibleToActor(
      order,
      input.actorUserId,
      'order and user not match'
    );

    const base =
      order.callbackUrl || toPaymentFallbackUrl(order.paymentType, appUrl);
    return appendOrderNoToUrl(base, input.orderNo, appUrl);
  } catch (error: unknown) {
    input.log.error('payment: checkout callback failed', { error });
    return toPricingFallbackUrl(appUrl);
  }
}

export async function resolvePaymentCallbackPricingFallbackUrl(
  deps?: Pick<PaymentCallbackDeps, 'readBillingRuntimeSettingsCached'>
) {
  try {
    const resolvedDeps = deps ?? (await getPaymentCallbackPricingDeps());
    const appUrl = await resolveAppUrl(resolvedDeps);
    return toPricingFallbackUrl(appUrl);
  } catch {
    return '/pricing';
  }
}

async function getPaymentCallbackReadDeps(): Promise<
  Pick<
    PaymentCallbackDeps,
    'readBillingRuntimeSettingsCached' | 'findOrderByOrderNo'
  >
> {
  const [settingsModule, orderModule] = await Promise.all([
    import('@/domains/settings/application/settings-runtime.query'),
    import('@/domains/billing/infra/order'),
  ]);

  return {
    readBillingRuntimeSettingsCached:
      settingsModule.readBillingRuntimeSettingsCached,
    findOrderByOrderNo: orderModule.findOrderByOrderNo,
  };
}

async function getPaymentCallbackPricingDeps(): Promise<
  Pick<PaymentCallbackDeps, 'readBillingRuntimeSettingsCached'>
> {
  const settingsModule =
    await import('@/domains/settings/application/settings-runtime.query');

  return {
    readBillingRuntimeSettingsCached:
      settingsModule.readBillingRuntimeSettingsCached,
  };
}

export async function confirmPaymentCallbackUseCase(
  input: {
    orderNo: string;
    actorUserId: string;
    actorUserEmail?: string | null;
    mode?: 'fresh' | 'cached';
    log: BillingCallbackLog;
  },
  deps?: PaymentCallbackDeps
) {
  const resolvedDeps = deps ?? (await getPaymentCallbackDeps());
  if (!input.actorUserEmail) {
    throw new UnauthorizedError('no auth, please sign in');
  }

  const appUrl = await resolveAppUrl(resolvedDeps);
  const order = await resolvedDeps.findOrderByOrderNo(input.orderNo);
  assertOrderVisibleToActor(order, input.actorUserId, 'no permission');

  if (!order.paymentSessionId || !order.paymentProvider) {
    throw new BadRequestError('invalid order');
  }

  const [settings, bindings] = await Promise.all([
    input.mode === 'fresh'
      ? resolvedDeps.readBillingRuntimeSettingsFresh()
      : resolvedDeps.readBillingRuntimeSettingsCached(),
    Promise.resolve(resolvedDeps.readPaymentRuntimeBindings()),
  ]);
  const paymentService = await resolvedDeps.getPaymentService({
    settings,
    bindings,
  });
  const session: PaymentSession = await paymentService.getPaymentSession({
    sessionId: order.paymentSessionId,
  });

  await resolvedDeps.handleCheckoutSuccess({
    order,
    session,
    log: input.log,
  });

  return {
    orderNo: input.orderNo,
    redirectUrl:
      order.callbackUrl || toPaymentFallbackUrl(order.paymentType, appUrl),
  };
}

async function resolveAppUrl(
  _deps: Pick<PaymentCallbackDeps, 'readBillingRuntimeSettingsCached'>
) {
  return resolveRuntimeAppUrl({
    NEXT_PUBLIC_APP_URL: getRuntimeEnvString('NEXT_PUBLIC_APP_URL'),
  });
}

function appendOrderNoToUrl(
  url: string,
  orderNo: string,
  appUrl: string
): string {
  try {
    const full = new URL(url, appUrl);
    full.searchParams.set('order_no', orderNo);
    return full.toString();
  } catch {
    return url;
  }
}

function toPaymentFallbackUrl(
  type: string | null | undefined,
  appUrl: string
): string {
  return type === PaymentType.SUBSCRIPTION
    ? `${appUrl}/settings/billing`
    : `${appUrl}/settings/payments`;
}

function toPricingFallbackUrl(appUrl: string): string {
  return `${appUrl}/pricing`;
}

function assertOrderVisibleToActor(
  order: Order | undefined,
  actorUserId: string,
  forbiddenMessage: string
): asserts order is Order {
  if (!order) {
    throw new NotFoundError('order not found');
  }
  if (order.userId !== actorUserId) {
    throw new ForbiddenError(forbiddenMessage);
  }
}

async function getPaymentCallbackDeps(): Promise<PaymentCallbackDeps> {
  const [settingsModule, orderModule, paymentServiceModule, flowsModule] =
    await Promise.all([
      import('@/domains/settings/application/settings-runtime.query'),
      import('@/domains/billing/infra/order'),
      import('@/infra/adapters/payment/service'),
      import('@/domains/billing/application/flows'),
    ]);
  const { getPaymentRuntimeBindings } =
    await import('@/infra/adapters/payment/runtime-bindings');

  return {
    readBillingRuntimeSettingsCached:
      settingsModule.readBillingRuntimeSettingsCached,
    readBillingRuntimeSettingsFresh:
      settingsModule.readBillingRuntimeSettingsFresh,
    readPaymentRuntimeBindings: getPaymentRuntimeBindings,
    findOrderByOrderNo: orderModule.findOrderByOrderNo,
    getPaymentService: paymentServiceModule.getPaymentService,
    handleCheckoutSuccess: flowsModule.handleCheckoutSuccess,
  };
}
