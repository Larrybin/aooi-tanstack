import { loadPricingSurfaceData } from '@/surfaces/landing/pricing/pricing.data';
import { getPricingSurfaceHead } from '@/surfaces/landing/pricing/pricing.seo';
import type { PricingRouteData } from '@/surfaces/landing/pricing/pricing.types';
import { PricingSurfaceView } from '@/surfaces/landing/pricing/pricing.view';
import { createFileRoute, notFound } from '@tanstack/react-router';

import { defaultLocale } from '@/config/locale';

export const Route = createFileRoute('/pricing')({
  loader: async () => {
    const data = await loadPricingSurfaceData(defaultLocale);
    if (!data) {
      throw notFound();
    }
    return data as PricingRouteData;
  },
  head: ({ loaderData }) => getPricingSurfaceHead(loaderData ?? null),
  component: PricingRoute,
});

function PricingRoute() {
  const data = Route.useLoaderData();
  return <PricingSurfaceView data={data} />;
}
