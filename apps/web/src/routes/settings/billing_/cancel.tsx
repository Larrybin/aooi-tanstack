import { loadSettingsBillingCancelRouteSurfaceData } from '@/surfaces/member/settings-billing-action/settings-billing-action.data';
import { getSettingsBillingActionRouteSurfaceHead } from '@/surfaces/member/settings-billing-action/settings-billing-action.seo';
import type { SettingsBillingActionRouteData } from '@/surfaces/member/settings-billing-action/settings-billing-action.types';
import { SettingsBillingActionRouteView } from '@/surfaces/member/settings-billing-action/settings-billing-action.view';
import { createFileRoute, notFound, redirect } from '@tanstack/react-router';

import { defaultLocale } from '@/config/locale';

export const Route = createFileRoute('/settings/billing_/cancel')({
  loader: async ({ location }) => {
    const data = await loadSettingsBillingCancelRouteSurfaceData({
      locale: defaultLocale,
      search: location.search,
    });
    if (!data) {
      throw notFound();
    }
    if (data.redirectHref) {
      throw redirect({ href: data.redirectHref });
    }
    return data as SettingsBillingActionRouteData;
  },
  head: ({ loaderData }) =>
    getSettingsBillingActionRouteSurfaceHead(loaderData ?? null),
  component: SettingsBillingCancelRoute,
});

function SettingsBillingCancelRoute() {
  const data = Route.useLoaderData();
  return <SettingsBillingActionRouteView data={data} />;
}
