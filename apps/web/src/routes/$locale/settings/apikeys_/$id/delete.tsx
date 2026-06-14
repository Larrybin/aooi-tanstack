import { loadSettingsApiKeysIdRouteSurfaceData } from '@/surfaces/member/settings-apikeys-id/settings-apikeys-id.data';
import { getSettingsApiKeysIdRouteSurfaceHead } from '@/surfaces/member/settings-apikeys-id/settings-apikeys-id.seo';
import type { SettingsApiKeysIdRouteData } from '@/surfaces/member/settings-apikeys-id/settings-apikeys-id.types';
import { SettingsApiKeysIdRouteView } from '@/surfaces/member/settings-apikeys-id/settings-apikeys-id.view';
import { createFileRoute, notFound } from '@tanstack/react-router';

export const Route = createFileRoute('/$locale/settings/apikeys_/$id/delete')({
  loader: async ({ params }) => {
    const data = await loadSettingsApiKeysIdRouteSurfaceData({
      locale: params.locale,
      id: params.id,
      mode: 'delete',
    });
    if (!data) {
      throw notFound({ data: { locale: params.locale } });
    }
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
