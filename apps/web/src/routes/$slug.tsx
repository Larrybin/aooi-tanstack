import { loadSlugSurfaceData } from '@/surfaces/landing/slug/slug.data';
import { getSlugSurfaceHead } from '@/surfaces/landing/slug/slug.seo';
import type { SlugRouteData } from '@/surfaces/landing/slug/slug.types';
import { SlugSurfaceView } from '@/surfaces/landing/slug/slug.view';
import { createFileRoute, notFound } from '@tanstack/react-router';

import { defaultLocale } from '@/config/locale';

export const Route = createFileRoute('/$slug')({
  loader: async ({ params }) => {
    const data = await loadSlugSurfaceData(defaultLocale, params.slug);
    if (!data) {
      throw notFound();
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
