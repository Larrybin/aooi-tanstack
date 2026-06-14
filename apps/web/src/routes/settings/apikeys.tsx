import { redirectUnsignedSettingsVisitor } from '@/server/member/settings-auth-redirect';
import { loadSettingsApiKeysRouteSurfaceData } from '@/surfaces/member/settings-apikeys/settings-apikeys.data';
import { getSettingsApiKeysRouteSurfaceHead } from '@/surfaces/member/settings-apikeys/settings-apikeys.seo';
import type { SettingsApiKeysRouteData } from '@/surfaces/member/settings-apikeys/settings-apikeys.types';
import { SettingsApiKeysRouteView } from '@/surfaces/member/settings-apikeys/settings-apikeys.view';
import { createFileRoute, notFound } from '@tanstack/react-router';

import { defaultLocale } from '@/config/locale';

export const Route = createFileRoute('/settings/apikeys')({
  loader: async ({ location }) => {
    const data = await loadSettingsApiKeysRouteSurfaceData({
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
    return data as SettingsApiKeysRouteData;
  },
  head: ({ loaderData }) =>
    getSettingsApiKeysRouteSurfaceHead(loaderData ?? null),
  component: SettingsApiKeysRoute,
});

function SettingsApiKeysRoute() {
  const data = Route.useLoaderData();
  return <SettingsApiKeysRouteView data={data} />;
}
