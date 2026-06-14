import { redirectUnsignedSettingsVisitor } from '@/server/member/settings-auth-redirect';
import { loadSettingsApiKeysIdRouteSurfaceData } from '@/surfaces/member/settings-apikeys-id/settings-apikeys-id.data';
import { getSettingsApiKeysIdRouteSurfaceHead } from '@/surfaces/member/settings-apikeys-id/settings-apikeys-id.seo';
import type { SettingsApiKeysIdRouteData } from '@/surfaces/member/settings-apikeys-id/settings-apikeys-id.types';
import { SettingsApiKeysIdRouteView } from '@/surfaces/member/settings-apikeys-id/settings-apikeys-id.view';
import { createFileRoute, notFound } from '@tanstack/react-router';

import { defaultLocale } from '@/config/locale';

export const Route = createFileRoute('/settings/apikeys_/$id/delete')({
  loader: async ({ params, location }) => {
    const data = await loadSettingsApiKeysIdRouteSurfaceData({
      locale: defaultLocale,
      id: params.id,
      mode: 'delete',
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
    return data as SettingsApiKeysIdRouteData;
  },
  head: ({ loaderData }) =>
    getSettingsApiKeysIdRouteSurfaceHead(loaderData ?? null),
  component: SettingsApiKeysDeleteRoute,
});

function SettingsApiKeysDeleteRoute() {
  const data = Route.useLoaderData();
  return <SettingsApiKeysIdRouteView data={data} />;
}
