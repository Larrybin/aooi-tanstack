import { useEffect } from 'react';
import type { PricingRouteData } from '@/domains/pricing/application/pricing-page';
import { PricingSliceView } from '@/domains/pricing/ui/pricing-slice-view';
import { createFileRoute } from '@tanstack/react-router';

import { defaultLocale, isRtlLocale } from '@/config/locale';

import { loadPricingRouteData } from '../server/pricing-route-data';

export const Route = createFileRoute('/pricing')({
  loader: async () => {
    const data = await loadPricingRouteData({
      data: { locale: defaultLocale },
    });
    if (!data) {
      throw new Response('Not found', { status: 404 });
    }
    return data as PricingRouteData;
  },
  head: ({ loaderData }) => loaderData?.head ?? {},
  component: PricingRoute,
});

function PricingRoute() {
  const data = Route.useLoaderData();
  useEffect(() => {
    document.documentElement.lang = data.locale;
    document.documentElement.dir = isRtlLocale(data.locale) ? 'rtl' : 'ltr';
  }, [data.locale]);

  return <PricingSliceView data={data} />;
}
