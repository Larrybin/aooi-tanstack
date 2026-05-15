import { findPricingItemByProductId } from '@/domains/billing/domain/pricing';
import { sitePricing } from '@/site';

import type { RemoverActor, RemoverPlanLimits } from './types';

function numberEntitlement(
  entitlements: Record<string, string | number | boolean> | undefined,
  key: string,
  fallback: number
): number {
  const value = entitlements?.[key];
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : fallback;
}

function booleanEntitlement(
  entitlements: Record<string, string | number | boolean> | undefined,
  key: string,
  fallback = false
): boolean {
  const value = entitlements?.[key];
  return typeof value === 'boolean' ? value : fallback;
}

export function resolveRemoverPlanLimits(
  actor: RemoverActor
): RemoverPlanLimits {
  const pricing = sitePricing?.pricing;
  const requestedProductId = actor.kind === 'user' ? actor.productId : null;
  const plan =
    (pricing && requestedProductId
      ? findPricingItemByProductId(pricing, requestedProductId)
      : undefined) ?? (pricing ? findPricingItemByProductId(pricing, 'free') : undefined);
  const entitlements = plan?.entitlements;

  if (actor.kind === 'anonymous') {
    return {
      productId: 'guest',
      processingLimit: numberEntitlement(entitlements, 'guest_daily_removals', 2),
      processingWindow: 'day',
      highResDownloads: 0,
      highResDownloadWindow: 'lifetime',
      maxUploadMb: 5,
      retentionDays: 1,
      lowResDownload: booleanEntitlement(entitlements, 'low_res_download', true),
      advancedMode: false,
      priorityQueue: false,
    };
  }

  const isPaid = Boolean(requestedProductId && requestedProductId !== 'free');
  return {
    productId: plan?.product_id ?? 'free',
    processingLimit: isPaid
      ? numberEntitlement(entitlements, 'monthly_removals', 5)
      : numberEntitlement(entitlements, 'daily_removals', 5),
    processingWindow: isPaid ? 'month' : 'day',
    highResDownloads: isPaid
      ? numberEntitlement(entitlements, 'monthly_high_res_downloads', 0)
      : numberEntitlement(entitlements, 'signup_high_res_downloads', 3),
    highResDownloadWindow: isPaid ? 'month' : 'lifetime',
    maxUploadMb: numberEntitlement(entitlements, 'max_upload_mb', 10),
    retentionDays: numberEntitlement(entitlements, 'retention_days', 7),
    lowResDownload: true,
    advancedMode: booleanEntitlement(entitlements, 'advanced_mode'),
    priorityQueue: booleanEntitlement(entitlements, 'priority_queue'),
  };
}

export function addRetentionDays(now: Date, retentionDays: number): Date {
  const expiresAt = new Date(now);
  expiresAt.setDate(expiresAt.getDate() + Math.max(1, retentionDays));
  return expiresAt;
}
