import { loadSettingsApiKeysIdRouteSurfaceData } from '@/surfaces/member/settings-apikeys-id/settings-apikeys-id.data';
import { getSettingsApiKeysIdRouteSurfaceHead } from '@/surfaces/member/settings-apikeys-id/settings-apikeys-id.seo';
import type { SettingsApiKeysIdRouteData } from '@/surfaces/member/settings-apikeys-id/settings-apikeys-id.types';
import { SettingsApiKeysIdRouteView } from '@/surfaces/member/settings-apikeys-id/settings-apikeys-id.view';
import { createFileRoute, notFound } from '@tanstack/react-router';

import { defaultLocale } from '@/config/locale';

export const Route = createFileRoute('/settings/apikeys_/$id/edit')({
  loader: async ({ params }) => {
    const data = await loadSettingsApiKeysIdRouteSurfaceData({
      locale: defaultLocale,
      id: params.id,
      mode: 'edit',
    });
    if (!data) {
      throw notFound();
    }
    return data as SettingsApiKeysIdRouteData;
  },
  head: ({ loaderData }) =>
    getSettingsApiKeysIdRouteSurfaceHead(loaderData ?? null),
  component: SettingsApiKeysEditRoute,
});

function SettingsApiKeysEditRoute() {
  const data = Route.useLoaderData();
  return <SettingsApiKeysIdRouteView data={data} />;
}
