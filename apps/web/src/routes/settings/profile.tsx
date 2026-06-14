import { redirectUnsignedSettingsVisitor } from '@/server/member/settings-auth-redirect';
import { loadSettingsProfileRouteSurfaceData } from '@/surfaces/member/settings-profile/settings-profile.data';
import { getSettingsProfileRouteSurfaceHead } from '@/surfaces/member/settings-profile/settings-profile.seo';
import type { SettingsProfileRouteData } from '@/surfaces/member/settings-profile/settings-profile.types';
import { SettingsProfileRouteView } from '@/surfaces/member/settings-profile/settings-profile.view';
import { createFileRoute, notFound } from '@tanstack/react-router';

import { defaultLocale } from '@/config/locale';

export const Route = createFileRoute('/settings/profile')({
  loader: async ({ location }) => {
    const data = await loadSettingsProfileRouteSurfaceData({
      locale: defaultLocale,
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
    return data as SettingsProfileRouteData;
  },
  head: ({ loaderData }) =>
    getSettingsProfileRouteSurfaceHead(loaderData ?? null),
  component: SettingsProfileRoute,
});

function SettingsProfileRoute() {
  const data = Route.useLoaderData();
  return <SettingsProfileRouteView data={data} />;
}
