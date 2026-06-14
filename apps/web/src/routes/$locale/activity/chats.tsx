import { loadActivityRouteSurfaceData } from '@/surfaces/member/activity/activity.data';
import { getActivityRouteSurfaceHead } from '@/surfaces/member/activity/activity.seo';
import type { ActivityRouteData } from '@/surfaces/member/activity/activity.types';
import { ActivityRouteView } from '@/surfaces/member/activity/activity.view';
import { createFileRoute, notFound } from '@tanstack/react-router';

export const Route = createFileRoute('/$locale/activity/chats')({
  loader: async ({ params, location }) => {
    const data = await loadActivityRouteSurfaceData({
      locale: params.locale,
      kind: 'chats',
      search: location.search,
    });
    if (!data) {
      throw notFound({ data: { locale: params.locale } });
    }
    return data as ActivityRouteData;
  },
  head: ({ loaderData }) => getActivityRouteSurfaceHead(loaderData ?? null),
  component: ActivityChatsRoute,
});

function ActivityChatsRoute() {
  const data = Route.useLoaderData();
  return <ActivityRouteView data={data} />;
}
