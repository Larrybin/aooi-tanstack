import { loadAdminRouteData } from '@/server/admin/admin-route-data';
import { NativeAdminView } from '@/surfaces/admin/admin-view';
import { createFileRoute, notFound, redirect } from '@tanstack/react-router';

import { defaultLocale } from '@/config/locale';

export const Route = createFileRoute('/admin_')({
  loader: async ({ location }) => {
    const data = await loadAdminRouteData({
      data: { locale: defaultLocale, splat: '', search: location.search },
    });
    if (data.status === 'not_found') {
      throw notFound();
    }
    if (data.status !== 'ok') throw redirect({ href: data.redirectTo });
    return data;
  },
  component: AdminRoute,
});

function AdminRoute() {
  return <NativeAdminView data={Route.useLoaderData()} />;
}
