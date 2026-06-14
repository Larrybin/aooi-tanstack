import { redirectUnsignedSettingsVisitor } from '@/server/member/settings-auth-redirect';
import { loadSettingsBillingRouteSurfaceData } from '@/surfaces/member/settings-billing/settings-billing.data';
import { getSettingsBillingRouteSurfaceHead } from '@/surfaces/member/settings-billing/settings-billing.seo';
import type { SettingsBillingRouteData } from '@/surfaces/member/settings-billing/settings-billing.types';
import { SettingsBillingRouteView } from '@/surfaces/member/settings-billing/settings-billing.view';
import { createFileRoute, notFound } from '@tanstack/react-router';

import { defaultLocale } from '@/config/locale';

export const Route = createFileRoute('/settings/billing')({
  loader: async ({ location }) => {
    const data = await loadSettingsBillingRouteSurfaceData({
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
