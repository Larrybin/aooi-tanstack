import { loadAuthRouteSurfaceData } from '@/surfaces/auth/auth-route/auth-route.data';
import { getAuthRouteSurfaceHead } from '@/surfaces/auth/auth-route/auth-route.seo';
import type { AuthRouteData } from '@/surfaces/auth/auth-route/auth-route.types';
import { AuthRouteView } from '@/surfaces/auth/auth-route/auth-route.view';
import { createFileRoute, notFound } from '@tanstack/react-router';

import { defaultLocale } from '@/config/locale';

export const Route = createFileRoute('/sign-up')({
  loader: async ({ location }) => {
    const data = await loadAuthRouteSurfaceData({
      locale: defaultLocale,
      mode: 'sign-up',
      search: location.search,
    });
    if (!data) {
      throw notFound();
    }
    return data as AuthRouteData;
  },
  head: ({ loaderData }) => getAuthRouteSurfaceHead(loaderData ?? null),
  component: AuthRoute,
});

function AuthRoute() {
  const data = Route.useLoaderData();
  return <AuthRouteView data={data} />;
}
