import { loadActivityRefreshRouteSurfaceData } from '@/surfaces/member/activity-refresh/activity-refresh.data';
import { getActivityRefreshRouteSurfaceHead } from '@/surfaces/member/activity-refresh/activity-refresh.seo';
import type { ActivityRefreshRouteData } from '@/surfaces/member/activity-refresh/activity-refresh.types';
import { ActivityRefreshRouteView } from '@/surfaces/member/activity-refresh/activity-refresh.view';
import { createFileRoute, notFound, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/$locale/activity/ai-tasks_/$id/refresh')(
  {
    loader: async ({ params }) => {
      const data = await loadActivityRefreshRouteSurfaceData({
        locale: params.locale,
        id: params.id,
      });
      if (!data) {
        throw notFound({ data: { locale: params.locale } });
      }
      if (data.redirectTo) {
        throw redirect({ href: data.redirectTo });
      }
      return data as ActivityRefreshRouteData;
    },
    head: ({ loaderData }) =>
      getActivityRefreshRouteSurfaceHead(loaderData ?? null),
    component: ActivityRefreshRoute,
  }
);

function ActivityRefreshRoute() {
  const data = Route.useLoaderData();
  return <ActivityRefreshRouteView data={data} />;
}
