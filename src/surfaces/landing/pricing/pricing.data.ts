import { loadPricingRouteData } from '@/server/pricing/pricing-route-data';

import type { PricingRouteData } from './pricing.types';

export async function loadPricingSurfaceData(locale: string) {
  const data = await loadPricingRouteData({
    data: { locale },
  });

  return data as PricingRouteData | null;
}
