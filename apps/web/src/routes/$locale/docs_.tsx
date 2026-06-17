import { loadDocsRouteData } from '@/server/docs/docs-route-data';
import { DocsRouteView } from '@/surfaces/docs/docs-route.view';
import { createFileRoute, notFound } from '@tanstack/react-router';

export const Route = createFileRoute('/$locale/docs_')({
  loader: async ({ params }) => {
    const data = await loadDocsRouteData({ data: { locale: params.locale, slug: [] } });
    if (!data) throw notFound();
    return data;
  },
  component: DocsRoute,
});

function DocsRoute() {
  return <DocsRouteView data={Route.useLoaderData()} />;
}
