import { loadSlugSurfaceData } from '@/surfaces/landing/slug/slug.data';
import { getSlugSurfaceHead } from '@/surfaces/landing/slug/slug.seo';
import type { SlugRouteData } from '@/surfaces/landing/slug/slug.types';
import { SlugSurfaceView } from '@/surfaces/landing/slug/slug.view';
import { createFileRoute, notFound } from '@tanstack/react-router';

export const Route = createFileRoute('/$locale/$slug')({
  loader: async ({ params }) => {
    const data = await loadSlugSurfaceData(params.locale, params.slug);
    if (!data) {
      throw notFound({ data: { locale: params.locale } });
    }
    return data as SlugRouteData;
  },
  head: ({ loaderData }) => getSlugSurfaceHead(loaderData ?? null),
  component: SlugRoute,
});

function SlugRoute() {
  const data = Route.useLoaderData();
  return <SlugSurfaceView data={data} />;
}
