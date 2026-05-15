import type {
  Pricing,
  PricingCurrency,
  PricingItem,
} from '@/shared/types/blocks/pricing';
import { sitePricing } from '@/site';

import { PaymentInterval, PaymentType } from './payment';

export function findPricingItemByProductId(
  pricing: Pricing,
  productId: string
): PricingItem | undefined {
  const items = pricing.items ?? [];
  return items.find((item) => item.product_id === productId);
}

export function isPricingItemCheckoutEnabled(
  pricingItem: PricingItem
): boolean {
  return pricingItem.checkout_enabled !== false && pricingItem.amount > 0;
}

export function resolvePricingEntitlements(
  productId: string,
  pricing: Pricing | null | undefined = sitePricing?.pricing
): Record<string, string | number | boolean> | undefined {
  if (!pricing) {
    return;
  }

  return findPricingItemByProductId(pricing, productId)?.entitlements;
}

export type CheckoutPricingContext = {
  defaultCurrency: string;
  checkoutCurrency: string;
  checkoutAmount: number;
  selectedCurrency?: PricingCurrency;
  paymentProductId?: string;
};

function normalizeCurrencyCode(currency: string | null | undefined): string {
  return (currency || '').trim().toLowerCase();
}

function normalizeOptionalString(
  value: string | null | undefined
): string | undefined {
  const normalized = (value || '').trim();
  return normalized ? normalized : undefined;
}

export function resolveCheckoutPricingContext({
  pricingItem,
  currency,
}: {
  pricingItem: PricingItem;
  currency: string | null | undefined;
}): CheckoutPricingContext {
  const defaultCurrency = normalizeCurrencyCode(pricingItem.currency || 'usd');
  const requestedCurrency = normalizeCurrencyCode(currency);

  const selectedCurrency =
    requestedCurrency && requestedCurrency !== defaultCurrency
      ? pricingItem.currencies?.find(
          (c) => normalizeCurrencyCode(c.currency) === requestedCurrency
        )
      : undefined;

  const checkoutCurrency = selectedCurrency
    ? requestedCurrency
    : defaultCurrency;
  const checkoutAmount = selectedCurrency
    ? selectedCurrency.amount
    : pricingItem.amount;

  const paymentProductId =
    normalizeOptionalString(selectedCurrency?.payment_product_id) ??
    normalizeOptionalString(pricingItem.payment_product_id);

  return {
    defaultCurrency,
    checkoutCurrency,
    checkoutAmount,
    selectedCurrency,
    paymentProductId,
  };
}

export function resolvePricingPaymentInterval(
  interval: PricingItem['interval']
): PaymentInterval {
  return (interval || PaymentInterval.ONE_TIME) as PaymentInterval;
}

export function resolvePaymentTypeFromInterval(
  interval: PaymentInterval
): PaymentType {
  return interval === PaymentInterval.ONE_TIME
    ? PaymentType.ONE_TIME
    : PaymentType.SUBSCRIPTION;
}

export function resolveSubscriptionPlanName(pricingItem: PricingItem): string {
  return (
    pricingItem.plan_name ||
    pricingItem.product_name ||
    pricingItem.title ||
    'subscription'
  );
}
