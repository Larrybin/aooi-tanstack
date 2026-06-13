import { loadMemberEntryRouteData } from '@/surfaces/member/member-entry/member-entry.data';
import { createFileRoute, notFound, redirect } from '@tanstack/react-router';

import { defaultLocale } from '@/config/locale';

export const Route = createFileRoute('/settings_')({
  loader: async ({ location }) => {
    const data = await loadMemberEntryRouteData({
      locale: defaultLocale,
      kind: 'settings',
      search: location.search,
    });
    if (!data) {
      throw notFound();
    }
    throw redirect({ href: data.redirectTo });
  },
});
