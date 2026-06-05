import 'server-only';

import {
  buildGrantCreditForOrder,
  type BillingGrantCredit,
} from '@/domains/billing/domain/credit';
import { buildBillingEntitlementGrantForOrder } from '@/domains/billing/domain/entitlement-grant';
import {
  PaymentStatus,
  PaymentType,
  type PaymentSession,
} from '@/domains/billing/domain/payment';
import {
  OrderStatus,
  updateOrderByOrderNo,
  updateOrderInTransaction,
  updateSubscriptionInTransaction,
  type NewOrder,
  type Order,
  type UpdateOrder,
} from '@/domains/billing/infra/order';
import {
  SubscriptionStatus,
  updateSubscriptionBySubscriptionNo,
  updateSubscriptionBySubscriptionNoIfNotCanceled,
  type NewSubscription,
  type Subscription,
  type UpdateSubscription,
} from '@/domains/billing/infra/subscription';
import { resolveAppEnvironment } from '@/domains/entitlements/domain/types';
import { getRuntimeEnvString } from '@/infra/runtime/env.server';
import { site, sitePricing } from '@/site';

import { getSnowId, getUuid } from '@/shared/lib/hash';

type LogLike = {
  debug(message: string, meta?: unknown): void;
  info(message: string, meta?: unknown): void;
  warn(message: string, meta?: unknown): void;
  error(message: string, meta?: unknown): void;
};

type OrderFlowName = 'checkout success' | 'payment success';

type ValidSubscription = Subscription & {
  subscriptionNo: string;
  amount: number;
  currency: string;
};

function toOrderFlowLogMeta({
  order,
  session,
  subscriptionNo,
}: {
  order: Order;
  session: PaymentSession;
  subscriptionNo?: string;
}) {
  return {
    orderNo: order.orderNo,
    provider: session.provider || order.paymentProvider,
    paymentStatus: session.paymentStatus,
    transactionId: session.paymentInfo?.transactionId,
    subscriptionId: session.subscriptionId,
    subscriptionNo: subscriptionNo || order.subscriptionNo,
    amount: session.paymentInfo?.paymentAmount ?? order.amount,
    currency: session.paymentInfo?.paymentCurrency ?? order.currency,
  };
}

function toSubscriptionFlowLogMeta({
  subscription,
  session,
  orderNo,
}: {
  subscription: Subscription;
  session: PaymentSession;
  orderNo?: string;
}) {
  return {
    orderNo,
    provider: session.provider || subscription.paymentProvider,
    paymentStatus: session.paymentStatus,
    transactionId: session.paymentInfo?.transactionId,
    subscriptionId: session.subscriptionId || subscription.subscriptionId,
    subscriptionNo: subscription.subscriptionNo,
    amount: subscription.amount,
    currency: subscription.currency,
  };
}

function toCreditGrantOrder(order: Order) {
  return {
    userId: order.userId,
    userEmail: order.userEmail,
    orderNo: order.orderNo,
    paymentType: order.paymentType as PaymentType,
    creditsAmount: order.creditsAmount,
    creditsValidDays: order.creditsValidDays,
  };
}

function resolveBillingEntitlementEnvironment() {
  return resolveAppEnvironment({
    configured: getRuntimeEnvString('APP_ENVIRONMENT'),
    nodeEnv: getRuntimeEnvString('NODE_ENV'),
  });
}

function isFinalOrderStatus(status: string) {
  return (
    status === OrderStatus.PAID ||
    status === OrderStatus.FAILED ||
    status === OrderStatus.COMPLETED
  );
}

function assertOrderNo(order: Order): string {
  const orderNo = order.orderNo;
  if (!orderNo) {
    throw new Error('invalid order');
  }
  return orderNo;
}

function shouldIgnoreFinalOrder({
  order,
  session,
  log,
  flow,
}: {
  order: Order;
  session: PaymentSession;
  log?: LogLike;
  flow: OrderFlowName;
}): boolean {
  if (!isFinalOrderStatus(order.status)) {
    return false;
  }

  log?.debug(
    `payment: ${flow} ignored finalized order`,
    toOrderFlowLogMeta({ order, session })
  );
  return true;
}

function assertSubscriptionInfoForOrder({
  order,
  session,
  log,
  flow,
}: {
  order: Order;
  session: PaymentSession;
  log?: LogLike;
  flow: OrderFlowName;
}): void {
  if (order.paymentType !== PaymentType.SUBSCRIPTION) return;

  if (session.subscriptionId && session.subscriptionInfo) {
    return;
  }

  log?.error(
    `payment: ${flow} missing subscription info`,
    toOrderFlowLogMeta({ order, session })
  );
  throw new Error('subscription id or subscription info not found');
}

function assertValidSubscriptionBasics(
  subscription: Subscription
): asserts subscription is ValidSubscription {
  if (
    !subscription.subscriptionNo ||
    !subscription.amount ||
    !subscription.currency
  ) {
    throw new Error('invalid subscription');
  }
}

function assertPaidPaymentMatchesOrder({
  order,
  session,
}: {
  order: Order;
  session: PaymentSession;
}) {
  const paidAmount = session.paymentInfo?.paymentAmount;
  const paidCurrency = session.paymentInfo?.paymentCurrency;
  if (paidAmount === undefined || paidAmount === null || !paidCurrency) {
    throw new Error('invalid payment info');
  }

  if (paidCurrency.toLowerCase() !== order.currency.toLowerCase()) {
    throw new Error('payment currency mismatch');
  }

  const discountAmount = session.paymentInfo?.discountAmount ?? 0;
  const expectedMinAmount = Math.max(0, order.amount - discountAmount);
  if (paidAmount < expectedMinAmount) {
    throw new Error('payment amount mismatch');
  }
}

function buildPaidUpdateOrder(session: PaymentSession): UpdateOrder {
  return {
    status: OrderStatus.PAID,
    paymentResult: JSON.stringify(session.paymentResult),
    paymentAmount: session.paymentInfo?.paymentAmount,
    paymentCurrency: session.paymentInfo?.paymentCurrency,
    discountAmount: session.paymentInfo?.discountAmount,
    discountCurrency: session.paymentInfo?.discountCurrency,
    discountCode: session.paymentInfo?.discountCode,
    paymentEmail: session.paymentInfo?.paymentEmail,
    paymentUserName: session.paymentInfo?.paymentUserName,
    paymentUserId: session.paymentInfo?.paymentUserId,
    paidAt: session.paymentInfo?.paidAt,
    invoiceId: session.paymentInfo?.invoiceId,
    invoiceUrl: session.paymentInfo?.invoiceUrl,
    transactionId: session.paymentInfo?.transactionId,
  };
}

function buildNewSubscription({
  order,
  session,
}: {
  order: Order;
  session: PaymentSession;
}): NewSubscription {
  const subscriptionInfo = session.subscriptionInfo;
  if (!subscriptionInfo) {
    throw new Error('invalid subscription info');
  }

  return {
    id: getUuid(),
    subscriptionNo: getSnowId(),
    userId: order.userId,
    userEmail: order.paymentEmail || order.userEmail,
    status: subscriptionInfo.status || SubscriptionStatus.ACTIVE,
    paymentProvider: order.paymentProvider,
    subscriptionId: subscriptionInfo.subscriptionId,
    subscriptionResult: JSON.stringify(session.subscriptionResult),
    productId: order.productId,
    description: subscriptionInfo.description || 'Subscription Created',
    amount: subscriptionInfo.amount,
    currency: subscriptionInfo.currency,
    interval: subscriptionInfo.interval,
    intervalCount: subscriptionInfo.intervalCount,
    trialPeriodDays: subscriptionInfo.trialPeriodDays,
    currentPeriodStart: subscriptionInfo.currentPeriodStart,
    currentPeriodEnd: subscriptionInfo.currentPeriodEnd,
    billingUrl: subscriptionInfo.billingUrl,
    planName: order.planName || order.productName,
    productName: order.productName,
    creditsAmount: order.creditsAmount,
    creditsValidDays: order.creditsValidDays,
    paymentProductId: order.paymentProductId,
    paymentUserId: session.paymentInfo?.paymentUserId,
  };
}

async function processSuccessfulPayment({
  order,
  session,
  log,
  flow,
}: {
  order: Order;
  session: PaymentSession;
  log?: LogLike;
  flow: OrderFlowName;
}) {
  try {
    assertPaidPaymentMatchesOrder({ order, session });
  } catch (error: unknown) {
    log?.error(`payment: ${flow} payment mismatch`, {
      ...toOrderFlowLogMeta({ order, session }),
      error,
    });
    throw error;
  }

  const updateOrder: UpdateOrder = {
    ...buildPaidUpdateOrder(session),
    subscriptionNo: '',
  };

  let newSubscription: NewSubscription | undefined;
  const subscriptionInfo = session.subscriptionInfo;

  if (subscriptionInfo) {
    newSubscription = buildNewSubscription({
      order,
      session,
    });

    updateOrder.subscriptionNo = newSubscription.subscriptionNo;
    updateOrder.subscriptionId = session.subscriptionId;
    updateOrder.subscriptionResult = JSON.stringify(session.subscriptionResult);
  }

  const newCredit = buildGrantCreditForOrder({
    order: toCreditGrantOrder(order),
    subscriptionNo: newSubscription?.subscriptionNo,
    subscriptionInfo,
  });
  const newEntitlementGrant = buildBillingEntitlementGrantForOrder({
    order,
    pricing: sitePricing?.pricing,
    siteKey: site.key,
    productKey: site.key,
    environment: resolveBillingEntitlementEnvironment(),
    now: session.paymentInfo?.paidAt ?? new Date(),
    createId: getUuid,
  });

  await updateOrderInTransaction({
    orderNo: order.orderNo,
    updateOrder,
    newSubscription,
    newCredit,
    newEntitlementGrant,
  });

  log?.info(`payment: ${flow} processed`, {
    ...toOrderFlowLogMeta({
      order,
      session,
      subscriptionNo: newSubscription?.subscriptionNo,
    }),
  });
}

function buildSubscriptionRenewalOrder({
  subscription,
  session,
  orderNo,
  currentTime,
}: {
  subscription: ValidSubscription;
  session: PaymentSession;
  orderNo: string;
  currentTime: Date;
}): NewOrder {
  return {
    id: getUuid(),
    orderNo,
    userId: subscription.userId,
    userEmail: subscription.userEmail,
    status: OrderStatus.PAID,
    amount: subscription.amount,
    currency: subscription.currency,
    productId: subscription.productId,
    paymentType: PaymentType.RENEW,
    paymentInterval: subscription.interval,
    paymentProvider: session.provider || subscription.paymentProvider,
    checkoutInfo: '',
    createdAt: currentTime,
    productName: subscription.productName,
    description: 'Subscription Renewal',
    callbackUrl: '',
    creditsAmount: subscription.creditsAmount,
    creditsValidDays: subscription.creditsValidDays,
    planName: subscription.planName || '',
    paymentProductId: subscription.paymentProductId,
    paymentResult: JSON.stringify(session.paymentResult),
    paymentAmount: session.paymentInfo?.paymentAmount,
    paymentCurrency: session.paymentInfo?.paymentCurrency,
    discountAmount: session.paymentInfo?.discountAmount,
    discountCurrency: session.paymentInfo?.discountCurrency,
    discountCode: session.paymentInfo?.discountCode,
    paymentEmail: session.paymentInfo?.paymentEmail,
    paymentUserId: session.paymentInfo?.paymentUserId,
    paidAt: session.paymentInfo?.paidAt,
    invoiceId: session.paymentInfo?.invoiceId,
    invoiceUrl: session.paymentInfo?.invoiceUrl,
    subscriptionNo: subscription.subscriptionNo,
    transactionId: session.paymentInfo?.transactionId,
    paymentUserName: session.paymentInfo?.paymentUserName,
    subscriptionId: session.subscriptionId,
    subscriptionResult: JSON.stringify(session.subscriptionResult),
  };
}

export async function handleCheckoutSuccess({
  order,
  session,
  log,
}: {
  order: Order;
  session: PaymentSession;
  log?: LogLike;
}) {
  const orderNo = assertOrderNo(order);

  log?.debug(
    'payment: checkout success start',
    toOrderFlowLogMeta({ order, session })
  );

  const flow: OrderFlowName = 'checkout success';
  if (shouldIgnoreFinalOrder({ order, session, log, flow })) return;
  assertSubscriptionInfoForOrder({ order, session, log, flow });

  switch (session.paymentStatus) {
    case PaymentStatus.SUCCESS:
      await processSuccessfulPayment({ order, session, log, flow });
      return;
    case PaymentStatus.FAILED:
    case PaymentStatus.CANCELED:
      await updateOrderByOrderNo(orderNo, {
        status: OrderStatus.FAILED,
        paymentResult: JSON.stringify(session.paymentResult),
      });
      log?.info(
        'payment: checkout success marked order failed',
        toOrderFlowLogMeta({ order, session })
      );
      return;
    case PaymentStatus.PROCESSING:
      await updateOrderByOrderNo(orderNo, {
        paymentResult: JSON.stringify(session.paymentResult),
      });
      log?.debug(
        'payment: checkout success received processing payment',
        toOrderFlowLogMeta({ order, session })
      );
      return;
    default:
      throw new Error('unknown payment status');
  }
}

export async function handlePaymentSuccess({
  order,
  session,
  log,
}: {
  order: Order;
  session: PaymentSession;
  log?: LogLike;
}) {
  assertOrderNo(order);

  log?.debug(
    'payment: payment success start',
    toOrderFlowLogMeta({ order, session })
  );

  const flow: OrderFlowName = 'payment success';
  if (shouldIgnoreFinalOrder({ order, session, log, flow })) return;
  assertSubscriptionInfoForOrder({ order, session, log, flow });

  if (session.paymentStatus !== PaymentStatus.SUCCESS) {
    throw new Error('unknown payment status');
  }
  await processSuccessfulPayment({ order, session, log, flow });
}

export async function handleSubscriptionRenewal({
  subscription,
  session,
  log,
}: {
  subscription: Subscription;
  session: PaymentSession;
  log?: LogLike;
}) {
  assertValidSubscriptionBasics(subscription);
  const subscriptionNo = subscription.subscriptionNo;

  log?.debug(
    'payment: subscription renewal start',
    toSubscriptionFlowLogMeta({ subscription, session })
  );

  if (!session.subscriptionId || !session.subscriptionInfo) {
    throw new Error('invalid payment session');
  }
  if (session.subscriptionId !== subscription.subscriptionId) {
    throw new Error('subscription id mismatch');
  }

  const subscriptionInfo = session.subscriptionInfo;
  if (
    !subscriptionInfo ||
    !subscriptionInfo.currentPeriodStart ||
    !subscriptionInfo.currentPeriodEnd
  ) {
    throw new Error('invalid subscription info');
  }

  if (session.paymentStatus !== PaymentStatus.SUCCESS) {
    throw new Error('unknown payment status');
  }

  const updateSubscription: UpdateSubscription = {
    currentPeriodStart: subscriptionInfo.currentPeriodStart,
    currentPeriodEnd: subscriptionInfo.currentPeriodEnd,
  };

  const orderNo = getSnowId();
  const currentTime = new Date();
  const order = buildSubscriptionRenewalOrder({
    subscription,
    session,
    orderNo,
    currentTime,
  });

  const newCredit: BillingGrantCredit | undefined = buildGrantCreditForOrder({
    order: {
      userId: order.userId,
      userEmail: order.userEmail,
      orderNo: order.orderNo,
      paymentType: PaymentType.RENEW,
      creditsAmount: order.creditsAmount,
      creditsValidDays: order.creditsValidDays,
    },
    subscriptionNo: subscription.subscriptionNo,
    subscriptionInfo,
  });

  await updateSubscriptionInTransaction({
    subscriptionNo,
    updateSubscription,
    newOrder: order,
    newCredit,
  });

  log?.info(
    'payment: subscription renewal processed',
    toSubscriptionFlowLogMeta({ subscription, session, orderNo })
  );
}

export async function handleSubscriptionUpdated({
  subscription,
  session,
  log,
}: {
  subscription: Subscription;
  session: PaymentSession;
  log?: LogLike;
}) {
  assertValidSubscriptionBasics(subscription);
  const subscriptionNo = subscription.subscriptionNo;

  log?.debug(
    'payment: subscription updated start',
    toSubscriptionFlowLogMeta({ subscription, session })
  );

  const subscriptionInfo = session.subscriptionInfo;
  if (!subscriptionInfo || !subscriptionInfo.status) {
    throw new Error('invalid subscription info');
  }

  const updateSubscriptionStatus: SubscriptionStatus = subscriptionInfo.status;

  const updated = await updateSubscriptionBySubscriptionNoIfNotCanceled(
    subscriptionNo,
    {
      status: updateSubscriptionStatus,
      currentPeriodStart: subscriptionInfo.currentPeriodStart,
      currentPeriodEnd: subscriptionInfo.currentPeriodEnd,
      canceledAt: subscriptionInfo.canceledAt || null,
      canceledEndAt: subscriptionInfo.canceledEndAt || null,
      canceledReason: subscriptionInfo.canceledReason || '',
      canceledReasonType: subscriptionInfo.canceledReasonType || '',
    }
  );

  if (!updated) {
    log?.debug(
      'payment: subscription updated ignored canceled subscription',
      toSubscriptionFlowLogMeta({ subscription, session })
    );
    return;
  }

  log?.info('payment: subscription updated processed', {
    ...toSubscriptionFlowLogMeta({ subscription, session }),
    status: updateSubscriptionStatus,
  });
}

export async function handleSubscriptionCanceled({
  subscription,
  session,
  log,
}: {
  subscription: Subscription;
  session: PaymentSession;
  log?: LogLike;
}) {
  assertValidSubscriptionBasics(subscription);
  const subscriptionNo = subscription.subscriptionNo;

  log?.debug(
    'payment: subscription canceled start',
    toSubscriptionFlowLogMeta({ subscription, session })
  );

  if (subscription.status === SubscriptionStatus.CANCELED) {
    log?.debug(
      'payment: subscription canceled ignored canceled subscription',
      toSubscriptionFlowLogMeta({ subscription, session })
    );
    return;
  }

  const subscriptionInfo = session.subscriptionInfo;
  if (
    !subscriptionInfo ||
    !subscriptionInfo.status ||
    !subscriptionInfo.canceledAt
  ) {
    throw new Error('invalid subscription info');
  }

  await updateSubscriptionBySubscriptionNo(subscriptionNo, {
    status: SubscriptionStatus.CANCELED,
    canceledAt: subscriptionInfo.canceledAt,
    canceledEndAt: subscriptionInfo.canceledEndAt,
    canceledReason: subscriptionInfo.canceledReason,
    canceledReasonType: subscriptionInfo.canceledReasonType,
  });

  log?.info(
    'payment: subscription canceled processed',
    toSubscriptionFlowLogMeta({ subscription, session })
  );
}
