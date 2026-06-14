import { loadSettingsBillingRouteSurfaceData } from '@/surfaces/member/settings-billing/settings-billing.data';
import { getSettingsBillingRouteSurfaceHead } from '@/surfaces/member/settings-billing/settings-billing.seo';
import type { SettingsBillingRouteData } from '@/surfaces/member/settings-billing/settings-billing.types';
import { SettingsBillingRouteView } from '@/surfaces/member/settings-billing/settings-billing.view';
import { createFileRoute, notFound } from '@tanstack/react-router';

export const Route = createFileRoute('/$locale/settings/billing')({
  loader: async ({ params, location }) => {
    const data = await loadSettingsBillingRouteSurfaceData({
      locale: params.locale,
      search: location.search,
    });
    if (!data) {
      throw notFound({ data: { locale: params.locale } });
    }
    return data as SettingsBillingRouteData;
  },
  head: ({ loaderData }) =>
    getSettingsBillingRouteSurfaceHead(loaderData ?? null),
  component: SettingsBillingRoute,
});

function SettingsBillingRoute() {
  const data = Route.useLoaderData();
  return <SettingsBillingRouteView data={data} />;
}
