import { redirectUnsignedSettingsVisitor } from '@/server/member/settings-auth-redirect';
import { loadActivityRouteSurfaceData } from '@/surfaces/member/activity/activity.data';
import { getActivityRouteSurfaceHead } from '@/surfaces/member/activity/activity.seo';
import type { ActivityRouteData } from '@/surfaces/member/activity/activity.types';
import { ActivityRouteView } from '@/surfaces/member/activity/activity.view';
import { createFileRoute, notFound } from '@tanstack/react-router';

export const Route = createFileRoute('/$locale/activity/feedbacks')({
  loader: async ({ params, location }) => {
    const data = await loadActivityRouteSurfaceData({
      locale: params.locale,
      kind: 'feedbacks',
    });
    if (!data) {
      throw notFound({ data: { locale: params.locale } });
    }
    redirectUnsignedSettingsVisitor({
      data,
      locale: data.locale,
      pathname: location.pathname,
      search: location.search,
    });
    return data as ActivityRouteData;
  },
  head: ({ loaderData }) => getActivityRouteSurfaceHead(loaderData ?? null),
  component: ActivityFeedbacksRoute,
});

function ActivityFeedbacksRoute() {
  const data = Route.useLoaderData();
  return <ActivityRouteView data={data} />;
}
