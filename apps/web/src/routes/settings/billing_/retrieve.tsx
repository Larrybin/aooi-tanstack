import { redirectUnsignedSettingsVisitor } from '@/server/member/settings-auth-redirect';
import { loadSettingsBillingPortalRouteSurfaceData } from '@/surfaces/member/settings-billing-action/settings-billing-action.data';
import { getSettingsBillingActionRouteSurfaceHead } from '@/surfaces/member/settings-billing-action/settings-billing-action.seo';
import type { SettingsBillingActionRouteData } from '@/surfaces/member/settings-billing-action/settings-billing-action.types';
import { SettingsBillingActionRouteView } from '@/surfaces/member/settings-billing-action/settings-billing-action.view';
import { createFileRoute, notFound, redirect } from '@tanstack/react-router';

import { defaultLocale } from '@/config/locale';

export const Route = createFileRoute('/settings/billing_/retrieve')({
  loader: async ({ location }) => {
    const data = await loadSettingsBillingPortalRouteSurfaceData({
      locale: defaultLocale,
      search: location.search,
    });
    if (!data) {
      throw notFound();
    }

    redirectUnsignedSettingsVisitor({
      data,
      locale: defaultLocale,
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
  component: SettingsBillingPortalRoute,
});

function SettingsBillingPortalRoute() {
  const data = Route.useLoaderData();
  return <SettingsBillingActionRouteView data={data} />;
}
