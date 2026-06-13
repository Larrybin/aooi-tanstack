import { loadAuthRouteSurfaceData } from '@/surfaces/auth/auth-route/auth-route.data';
import { getAuthRouteSurfaceHead } from '@/surfaces/auth/auth-route/auth-route.seo';
import type { AuthRouteData } from '@/surfaces/auth/auth-route/auth-route.types';
import { AuthRouteView } from '@/surfaces/auth/auth-route/auth-route.view';
import { createFileRoute, notFound } from '@tanstack/react-router';

export const Route = createFileRoute('/$locale/sign-in')({
  loader: async ({ params, location }) => {
    const data = await loadAuthRouteSurfaceData({
      locale: params.locale,
      mode: 'sign-in',
      search: location.search,
    });
    if (!data) {
      throw notFound({ data: { locale: params.locale } });
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
