
import {
  PaymentType,
  type SubscriptionInfo,
} from '@/domains/billing/domain/payment';

import { getSnowId, getUuid } from '@/shared/lib/hash';

export type BillingGrantCredit = {
  id: string;
  userId: string;
  userEmail?: string | null;
  orderNo?: string | null;
  subscriptionNo?: string | null;
  transactionNo: string;
  transactionType: BillingCreditTransactionType;
  transactionScene: BillingCreditTransactionScene;
  credits: number;
  remainingCredits: number;
  description: string;
  expiresAt: Date | null;
  status: BillingCreditStatus;
};

export enum BillingCreditStatus {
  ACTIVE = 'active',
}

export enum BillingCreditTransactionType {
  GRANT = 'grant',
}

export enum BillingCreditTransactionScene {
  PAYMENT = 'payment',
  SUBSCRIPTION = 'subscription',
  RENEWAL = 'renewal',
}

function calculateBillingCreditExpirationTime({
  creditsValidDays,
  currentPeriodEnd,
}: {
  creditsValidDays: number;
  currentPeriodEnd?: Date;
}) {
  const now = new Date();

  if (!creditsValidDays || creditsValidDays <= 0) {
    return null;
  }

  if (currentPeriodEnd) {
    return new Date(currentPeriodEnd.getTime());
  }

  const expiresAt = new Date();
  expiresAt.setDate(now.getDate() + creditsValidDays);
  return expiresAt;
}

export function getCreditTransactionSceneForPaymentType(
  paymentType: PaymentType
): BillingCreditTransactionScene {
  switch (paymentType) {
    case PaymentType.SUBSCRIPTION:
      return BillingCreditTransactionScene.SUBSCRIPTION;
    case PaymentType.RENEW:
      return BillingCreditTransactionScene.RENEWAL;
    case PaymentType.ONE_TIME:
    default:
      return BillingCreditTransactionScene.PAYMENT;
  }
}

export function buildGrantCreditForOrder({
  order,
  subscriptionNo,
  subscriptionInfo,
}: {
  order: {
    userId: string;
    userEmail?: string | null;
    orderNo?: string | null;
    paymentType: PaymentType;
    creditsAmount?: number | null;
    creditsValidDays?: number | null;
  };
  subscriptionNo?: string;
  subscriptionInfo?: SubscriptionInfo;
}): BillingGrantCredit | undefined {
  if (!order.creditsAmount || order.creditsAmount <= 0) {
    return undefined;
  }

  const credits = order.creditsAmount;
  const expiresAt =
    credits > 0
      ? calculateBillingCreditExpirationTime({
          creditsValidDays: order.creditsValidDays || 0,
          currentPeriodEnd: subscriptionInfo?.currentPeriodEnd,
        })
      : null;

  return {
    id: getUuid(),
    userId: order.userId,
    userEmail: order.userEmail,
    orderNo: order.orderNo,
    subscriptionNo,
    transactionNo: getSnowId(),
    transactionType: BillingCreditTransactionType.GRANT,
    transactionScene: getCreditTransactionSceneForPaymentType(
      order.paymentType
    ),
    credits,
    remainingCredits: credits,
    description: 'Grant credit',
    expiresAt,
    status: BillingCreditStatus.ACTIVE,
  };
}
