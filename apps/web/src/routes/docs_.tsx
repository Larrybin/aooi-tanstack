import { loadDocsRouteData } from '@/server/docs/docs-route-data';
import { DocsRouteView } from '@/surfaces/docs/docs-route.view';
import { createFileRoute, notFound } from '@tanstack/react-router';

export const Route = createFileRoute('/docs_')({
  loader: async () => {
    const data = await loadDocsRouteData({ data: { locale: 'en', slug: [] } });
    if (!data) throw notFound();
    return data;
  },
  component: DocsRoute,
});

function DocsRoute() {
  return <DocsRouteView data={Route.useLoaderData()} />;
}
