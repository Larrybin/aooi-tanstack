import { loadMemberEntryRouteData } from '@/surfaces/member/member-entry/member-entry.data';
import { createFileRoute, notFound, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/$locale/activity_')({
  loader: async ({ params, location }) => {
    const data = await loadMemberEntryRouteData({
      locale: params.locale,
      kind: 'activity',
      search: location.search,
    });
    if (!data) {
      throw notFound({ data: { locale: params.locale } });
    }
    throw redirect({ href: data.redirectTo });
  },
});
