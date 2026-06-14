import { loadSettingsCreditsRouteSurfaceData } from '@/surfaces/member/settings-credits/settings-credits.data';
import { getSettingsCreditsRouteSurfaceHead } from '@/surfaces/member/settings-credits/settings-credits.seo';
import type { SettingsCreditsRouteData } from '@/surfaces/member/settings-credits/settings-credits.types';
import { SettingsCreditsRouteView } from '@/surfaces/member/settings-credits/settings-credits.view';
import { createFileRoute, notFound } from '@tanstack/react-router';

import { defaultLocale } from '@/config/locale';

export const Route = createFileRoute('/settings/credits')({
  loader: async ({ location }) => {
    const data = await loadSettingsCreditsRouteSurfaceData({
      locale: defaultLocale,
      search: location.search,
    });
    if (!data) {
      throw notFound();
    }
    return data as SettingsCreditsRouteData;
  },
  head: ({ loaderData }) =>
    getSettingsCreditsRouteSurfaceHead(loaderData ?? null),
  component: SettingsCreditsRoute,
});

function SettingsCreditsRoute() {
  const data = Route.useLoaderData();
  return <SettingsCreditsRouteView data={data} />;
}
