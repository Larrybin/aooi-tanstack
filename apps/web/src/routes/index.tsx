import { loadHomeSurfaceData } from '@/surfaces/landing/home/home.data';
import { getHomeSurfaceHead } from '@/surfaces/landing/home/home.seo';
import type { HomeRouteData } from '@/surfaces/landing/home/home.types';
import { HomeSurfaceView } from '@/surfaces/landing/home/home.view';
import { createFileRoute, notFound } from '@tanstack/react-router';

import { defaultLocale } from '@/config/locale';

export const Route = createFileRoute('/')({
  loader: async () => {
    const data = await loadHomeSurfaceData(defaultLocale);
    if (!data) {
      throw notFound();
    }
    return data as HomeRouteData;
  },
  head: ({ loaderData }) => getHomeSurfaceHead(loaderData ?? null),
  component: HomeRoute,
});

function HomeRoute() {
  const data = Route.useLoaderData();
  return <HomeSurfaceView data={data} />;
}
