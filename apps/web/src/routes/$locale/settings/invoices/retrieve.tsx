import { redirectUnsignedSettingsVisitor } from '@/server/member/settings-auth-redirect';
import { loadSettingsInvoiceRetrieveRouteSurfaceData } from '@/surfaces/member/settings-billing-action/settings-billing-action.data';
import { getSettingsBillingActionRouteSurfaceHead } from '@/surfaces/member/settings-billing-action/settings-billing-action.seo';
import type { SettingsBillingActionRouteData } from '@/surfaces/member/settings-billing-action/settings-billing-action.types';
import { SettingsBillingActionRouteView } from '@/surfaces/member/settings-billing-action/settings-billing-action.view';
import { createFileRoute, notFound, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/$locale/settings/invoices/retrieve')({
  loader: async ({ params, location }) => {
    const data = await loadSettingsInvoiceRetrieveRouteSurfaceData({
      locale: params.locale,
      search: location.search,
    });
    if (!data) {
      throw notFound({ data: { locale: params.locale } });
    }

    redirectUnsignedSettingsVisitor({
      data,
      locale: params.locale,
      pathname: location.pathname,
      search: location.search,
    });
    if (data.redirectHref) {
      throw redirect({ href: data.redirectHref });
    }
    return data as SettingsBillingActionRouteData;
  },
  head: ({ loaderData }) =>
    getSettingsBillingActionRouteSurfaceHead(loaderData ?? null),
  component: SettingsInvoiceRetrieveRoute,
});

function SettingsInvoiceRetrieveRoute() {
  const data = Route.useLoaderData();
  return <SettingsBillingActionRouteView data={data} />;
}
