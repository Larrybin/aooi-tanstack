import { redirectUnsignedSettingsVisitor } from '@/server/member/settings-auth-redirect';
import { loadActivityRouteSurfaceData } from '@/surfaces/member/activity/activity.data';
import { getActivityRouteSurfaceHead } from '@/surfaces/member/activity/activity.seo';
import type { ActivityRouteData } from '@/surfaces/member/activity/activity.types';
import { ActivityRouteView } from '@/surfaces/member/activity/activity.view';
import { createFileRoute, notFound } from '@tanstack/react-router';

import { defaultLocale } from '@/config/locale';

export const Route = createFileRoute('/activity/chats')({
  loader: async ({ location }) => {
    const data = await loadActivityRouteSurfaceData({
      locale: defaultLocale,
      kind: 'chats',
      search: location.search,
    });
    if (!data) {
      throw notFound();
    }
    redirectUnsignedSettingsVisitor({
      data,
      locale: defaultLocale,
      pathname: '/activity/chats',
      search: location.search,
    });
    return data as ActivityRouteData;
  },
  head: ({ loaderData }) => getActivityRouteSurfaceHead(loaderData ?? null),
  component: ActivityChatsRoute,
});

function ActivityChatsRoute() {
  const data = Route.useLoaderData();
  return <ActivityRouteView data={data} />;
}
