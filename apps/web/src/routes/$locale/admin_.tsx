import { loadAdminRouteData } from '@/server/admin/admin-route-data';
import { NativeAdminView } from '@/surfaces/admin/admin-view';
import { createFileRoute, redirect } from '@tanstack/react-router';

import { defaultLocale } from '@/config/locale';

export const Route = createFileRoute('/$locale/admin_')({
  loader: async ({ params, location }) => {
    const data = await loadAdminRouteData({
      data: { locale: params.locale, splat: '', search: location.search },
    });
    if (data.status !== 'ok') throw redirect({ href: data.redirectTo });
    return data;
  },
  component: AdminRoute,
});

function AdminRoute() {
  return <NativeAdminView data={Route.useLoaderData()} />;
}
