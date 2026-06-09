import { useEffect } from 'react';
import type { PricingRouteData } from '@/domains/pricing/application/pricing-page';
import { PricingSliceView } from '@/domains/pricing/ui/pricing-slice-view';
import { createFileRoute } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';

import { isRtlLocale } from '@/config/locale';

function toSerializablePricingRouteData(data: PricingRouteData | null) {
  return data ? JSON.parse(JSON.stringify(data)) : null;
}

const loadPricingRouteData = createServerFn({ method: 'GET' })
  .validator((data: { locale: string }) => data)
  .handler(async ({ data }) => {
    const { resolvePricingRouteData } =
      await import('@/domains/pricing/application/pricing-page');
    return toSerializablePricingRouteData(
      await resolvePricingRouteData({ locale: data.locale })
    );
  });

export const Route = createFileRoute('/$locale/pricing')({
  loader: async ({ params }) => {
    const data = await loadPricingRouteData({
      data: { locale: params.locale },
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
