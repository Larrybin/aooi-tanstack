import { resolvePricingRouteData } from '@/domains/pricing/application/pricing-page';
import { PricingSliceView } from '@/domains/pricing/ui/pricing-slice-view';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/$locale/pricing')({
  loader: ({ params }) => resolvePricingRouteData({ locale: params.locale }),
  head: ({ loaderData }) => loaderData?.head ?? {},
  component: PricingRoute,
});

function PricingRoute() {
  const data = Route.useLoaderData();
  return <PricingSliceView data={data} />;
}
