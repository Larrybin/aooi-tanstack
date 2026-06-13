import { loadSettingsSecurityRouteSurfaceData } from '@/surfaces/member/settings-security/settings-security.data';
import { getSettingsSecurityRouteSurfaceHead } from '@/surfaces/member/settings-security/settings-security.seo';
import type { SettingsSecurityRouteData } from '@/surfaces/member/settings-security/settings-security.types';
import { SettingsSecurityRouteView } from '@/surfaces/member/settings-security/settings-security.view';
import { createFileRoute, notFound } from '@tanstack/react-router';

import { defaultLocale } from '@/config/locale';

export const Route = createFileRoute('/settings/security')({
  loader: async () => {
    const data = await loadSettingsSecurityRouteSurfaceData({
      locale: defaultLocale,
    });
    if (!data) {
      throw notFound();
    }
    return data as SettingsSecurityRouteData;
  },
  head: ({ loaderData }) =>
    getSettingsSecurityRouteSurfaceHead(loaderData ?? null),
  component: SettingsSecurityRoute,
});

function SettingsSecurityRoute() {
  const data = Route.useLoaderData();
  return <SettingsSecurityRouteView data={data} />;
}
