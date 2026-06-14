import { redirectUnsignedSettingsVisitor } from '@/server/member/settings-auth-redirect';
import { loadSettingsApiKeysCreateRouteSurfaceData } from '@/surfaces/member/settings-apikeys-create/settings-apikeys-create.data';
import { getSettingsApiKeysCreateRouteSurfaceHead } from '@/surfaces/member/settings-apikeys-create/settings-apikeys-create.seo';
import type { SettingsApiKeysCreateRouteData } from '@/surfaces/member/settings-apikeys-create/settings-apikeys-create.types';
import { SettingsApiKeysCreateRouteView } from '@/surfaces/member/settings-apikeys-create/settings-apikeys-create.view';
import { createFileRoute, notFound } from '@tanstack/react-router';

export const Route = createFileRoute('/$locale/settings/apikeys_/create')({
  loader: async ({ params, location }) => {
    const data = await loadSettingsApiKeysCreateRouteSurfaceData({
      locale: params.locale,
    });
    if (!data) {
      throw notFound({ data: { locale: params.locale } });
    }

    redirectUnsignedSettingsVisitor({
      data,
      locale: params.locale,
      pathname: location.pathname,
      search: location.search,
    });
    return data as SettingsApiKeysCreateRouteData;
  },
  head: ({ loaderData }) =>
    getSettingsApiKeysCreateRouteSurfaceHead(loaderData ?? null),
  component: SettingsApiKeysCreateRoute,
});

function SettingsApiKeysCreateRoute() {
  const data = Route.useLoaderData();
  return <SettingsApiKeysCreateRouteView data={data} />;
}
