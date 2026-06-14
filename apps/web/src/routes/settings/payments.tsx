import { redirectUnsignedSettingsVisitor } from '@/server/member/settings-auth-redirect';
import { loadSettingsPaymentsRouteSurfaceData } from '@/surfaces/member/settings-payments/settings-payments.data';
import { getSettingsPaymentsRouteSurfaceHead } from '@/surfaces/member/settings-payments/settings-payments.seo';
import type { SettingsPaymentsRouteData } from '@/surfaces/member/settings-payments/settings-payments.types';
import { SettingsPaymentsRouteView } from '@/surfaces/member/settings-payments/settings-payments.view';
import { createFileRoute, notFound } from '@tanstack/react-router';

import { defaultLocale } from '@/config/locale';

export const Route = createFileRoute('/settings/payments')({
  loader: async ({ location }) => {
    const data = await loadSettingsPaymentsRouteSurfaceData({
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
