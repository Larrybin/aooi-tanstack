import { loadSettingsProfileRouteSurfaceData } from '@/surfaces/member/settings-profile/settings-profile.data';
import { getSettingsProfileRouteSurfaceHead } from '@/surfaces/member/settings-profile/settings-profile.seo';
import type { SettingsProfileRouteData } from '@/surfaces/member/settings-profile/settings-profile.types';
import { SettingsProfileRouteView } from '@/surfaces/member/settings-profile/settings-profile.view';
import { createFileRoute, notFound } from '@tanstack/react-router';

export const Route = createFileRoute('/$locale/settings/profile')({
  loader: async ({ params }) => {
    const data = await loadSettingsProfileRouteSurfaceData({
      locale: params.locale,
    });
    if (!data) {
      throw notFound({ data: { locale: params.locale } });
    }
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
