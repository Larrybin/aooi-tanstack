import { stringifyProductEntitlements } from '@/domains/entitlements/domain/entitlements';
import type { EntitlementGrantRecord } from '@/domains/entitlements/domain/types';

import { getUuid } from '@/shared/lib/hash';
import type { Pricing } from '@/shared/types/blocks/pricing';

import { PaymentType } from './payment';
import { findPricingItemByProductId } from './pricing';

const LIFETIME_ENTITLEMENT_EXPIRES_AT = new Date(
  Date.UTC(9999, 11, 31, 23, 59, 59, 999)
);

export type BillingEntitlementGrant = EntitlementGrantRecord;

export function buildBillingEntitlementGrantForOrder({
  order,
  pricing,
  siteKey,
  productKey,
  environment,
  now = new Date(),
  createId = getUuid,
}: {
  order: {
    orderNo: string;
    userId: string;
    paymentType?: PaymentType | string | null;
    productId?: string | null;
  };
  pricing?: Pricing | null;
  siteKey: string;
  productKey: string;
  environment: string;
  now?: Date;
  createId?: () => string;
}): BillingEntitlementGrant | undefined {
  if (
    order.paymentType !== PaymentType.ONE_TIME ||
    !order.productId ||
    !pricing
  ) {
    return;
  }

  const pricingItem = findPricingItemByProductId(pricing, order.productId);
  if (!pricingItem?.entitlements) {
    return;
  }

  return {
    id: createId(),
    userId: order.userId,
    siteKey,
    productKey,
    environment,
    source: 'billing',
    status: 'active',
    entitlementsJson: stringifyProductEntitlements({
      productKey,
      entitlements: pricingItem.entitlements,
      source: 'grant',
    }),
    reason: `order:${order.orderNo}`,
    grantedByUserId: null,
    startsAt: now,
    expiresAt: LIFETIME_ENTITLEMENT_EXPIRES_AT,
    revokedAt: null,
    createdAt: now,
  };
}
