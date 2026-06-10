import type { PricingRouteData } from '@/domains/pricing/application/pricing-page';
import { createServerFn } from '@tanstack/react-start';

function toSerializablePricingRouteData(data: PricingRouteData | null) {
  return data ? JSON.parse(JSON.stringify(data)) : null;
}

export const loadPricingRouteData = createServerFn({ method: 'GET' })
  .validator((data: { locale: string }) => data)
  .handler(async ({ data }) => {
    const { resolvePricingRouteData } =
      await import('@/domains/pricing/application/pricing-page');
    return toSerializablePricingRouteData(
      await resolvePricingRouteData({ locale: data.locale })
    );
  });
