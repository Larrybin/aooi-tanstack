import { redirectUnsignedSettingsVisitor } from '@/server/member/settings-auth-redirect';
import { loadActivityRouteSurfaceData } from '@/surfaces/member/activity/activity.data';
import { getActivityRouteSurfaceHead } from '@/surfaces/member/activity/activity.seo';
import type { ActivityRouteData } from '@/surfaces/member/activity/activity.types';
import { ActivityRouteView } from '@/surfaces/member/activity/activity.view';
import { createFileRoute, notFound } from '@tanstack/react-router';

import { defaultLocale } from '@/config/locale';

export const Route = createFileRoute('/activity/feedbacks')({
  loader: async ({ location }) => {
    const data = await loadActivityRouteSurfaceData({
      locale: defaultLocale,
      kind: 'feedbacks',
    });
    if (!data) {
      throw notFound();
    }
    redirectUnsignedSettingsVisitor({
      data,
      locale: defaultLocale,
      pathname: '/activity/feedbacks',
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
