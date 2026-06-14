import { loadSettingsApiKeysRouteSurfaceData } from '@/surfaces/member/settings-apikeys/settings-apikeys.data';
import { getSettingsApiKeysRouteSurfaceHead } from '@/surfaces/member/settings-apikeys/settings-apikeys.seo';
import type { SettingsApiKeysRouteData } from '@/surfaces/member/settings-apikeys/settings-apikeys.types';
import { SettingsApiKeysRouteView } from '@/surfaces/member/settings-apikeys/settings-apikeys.view';
import { createFileRoute, notFound } from '@tanstack/react-router';

export const Route = createFileRoute('/$locale/settings/apikeys')({
  loader: async ({ params, location }) => {
    const data = await loadSettingsApiKeysRouteSurfaceData({
      locale: params.locale,
      search: location.search,
    });
    if (!data) {
      throw notFound({ data: { locale: params.locale } });
    }
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
