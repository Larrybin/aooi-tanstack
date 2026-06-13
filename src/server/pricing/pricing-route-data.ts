import type { PricingRouteData } from '@/surfaces/landing/pricing/pricing.types';
import { createServerFn } from '@tanstack/react-start';

import { normalizeLocale } from '@/shared/i18n/locale';

function toSerializablePricingRouteData(data: PricingRouteData | null) {
  return data ? JSON.parse(JSON.stringify(data)) : null;
}

export const loadPricingRouteData = createServerFn({ method: 'GET' })
  .validator((data: { locale: string }) => data)
  .handler(async ({ data }) => {
    const locale = normalizeLocale(data.locale);
    if (!locale) {
      return null;
    }

    const [
      { resolvePricingRouteData },
      { buildPricingRouteData },
      { loadPricingPageMessages },
    ] = await Promise.all([
      import('@/domains/pricing/application/pricing-page'),
      import('@/server/pricing/pricing-route-resolver'),
      import('@/server/pricing/pricing-page-messages'),
    ]);
    const messages = await loadPricingPageMessages(locale);

    const pricingData = await resolvePricingRouteData({ locale, ...messages });

    return toSerializablePricingRouteData(buildPricingRouteData(pricingData));
  });
