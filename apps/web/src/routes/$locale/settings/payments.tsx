import { loadSettingsPaymentsRouteSurfaceData } from '@/surfaces/member/settings-payments/settings-payments.data';
import { getSettingsPaymentsRouteSurfaceHead } from '@/surfaces/member/settings-payments/settings-payments.seo';
import type { SettingsPaymentsRouteData } from '@/surfaces/member/settings-payments/settings-payments.types';
import { SettingsPaymentsRouteView } from '@/surfaces/member/settings-payments/settings-payments.view';
import { createFileRoute, notFound } from '@tanstack/react-router';

export const Route = createFileRoute('/$locale/settings/payments')({
  loader: async ({ params, location }) => {
    const data = await loadSettingsPaymentsRouteSurfaceData({
      locale: params.locale,
      search: location.search,
    });
    if (!data) {
      throw notFound({ data: { locale: params.locale } });
    }
    return data as SettingsPaymentsRouteData;
  },
  head: ({ loaderData }) =>
    getSettingsPaymentsRouteSurfaceHead(loaderData ?? null),
  component: SettingsPaymentsRoute,
});

function SettingsPaymentsRoute() {
  const data = Route.useLoaderData();
  return <SettingsPaymentsRouteView data={data} />;
}
