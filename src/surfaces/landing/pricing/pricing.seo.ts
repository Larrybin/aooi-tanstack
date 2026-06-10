import type { PricingRouteData } from './pricing.types';

export function getPricingSurfaceHead(data: PricingRouteData | null) {
  return data?.head ?? {};
}
