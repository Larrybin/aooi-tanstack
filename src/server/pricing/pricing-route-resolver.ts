import type { PricingPageData } from '@/domains/pricing/application/pricing-page';
import { resolveLandingShellData } from '@/server/landing/landing-shell-data';
import type { PricingRouteData } from '@/surfaces/landing/pricing/pricing.types';

export function buildPricingRouteData(
  data: PricingPageData | null
): PricingRouteData | null {
  return data
    ? {
        ...data,
        shell: resolveLandingShellData(data.locale),
      }
    : null;
}
