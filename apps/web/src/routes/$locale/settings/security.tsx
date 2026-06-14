import { redirectUnsignedSettingsVisitor } from '@/server/member/settings-auth-redirect';
import { loadSettingsSecurityRouteSurfaceData } from '@/surfaces/member/settings-security/settings-security.data';
import { getSettingsSecurityRouteSurfaceHead } from '@/surfaces/member/settings-security/settings-security.seo';
import type { SettingsSecurityRouteData } from '@/surfaces/member/settings-security/settings-security.types';
import { SettingsSecurityRouteView } from '@/surfaces/member/settings-security/settings-security.view';
import { createFileRoute, notFound } from '@tanstack/react-router';

export const Route = createFileRoute('/$locale/settings/security')({
  loader: async ({ params, location }) => {
    const data = await loadSettingsSecurityRouteSurfaceData({
      locale: params.locale,
    });
    if (!data) {
      throw notFound({ data: { locale: params.locale } });
    }

    redirectUnsignedSettingsVisitor({
      data,
      locale: params.locale,
      pathname: location.pathname,
      search: location.search,
    });
    return data as SettingsSecurityRouteData;
  },
  head: ({ loaderData }) =>
    getSettingsSecurityRouteSurfaceHead(loaderData ?? null),
  component: SettingsSecurityRoute,
});

function SettingsSecurityRoute() {
  const data = Route.useLoaderData();
  return <SettingsSecurityRouteView data={data} />;
}
