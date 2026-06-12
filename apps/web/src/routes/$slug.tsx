import { loadHomeSurfaceData } from '@/surfaces/landing/home/home.data';
import { getHomeSurfaceHead } from '@/surfaces/landing/home/home.seo';
import type { HomeRouteData } from '@/surfaces/landing/home/home.types';
import { HomeSurfaceView } from '@/surfaces/landing/home/home.view';
import { loadSlugSurfaceData } from '@/surfaces/landing/slug/slug.data';
import { getSlugSurfaceHead } from '@/surfaces/landing/slug/slug.seo';
import type { SlugRouteData } from '@/surfaces/landing/slug/slug.types';
import { SlugSurfaceView } from '@/surfaces/landing/slug/slug.view';
import { createFileRoute, notFound } from '@tanstack/react-router';

import { defaultLocale } from '@/config/locale';
import { normalizeLocale } from '@/shared/i18n/locale';

type SingleSegmentRouteData =
  | { kind: 'home'; data: HomeRouteData }
  | { kind: 'slug'; data: SlugRouteData };

export const Route = createFileRoute('/$slug')({
  loader: async ({ params }) => {
    const locale = normalizeLocale(params.slug);
    if (locale) {
      const homeData = await loadHomeSurfaceData(locale);
      if (!homeData) {
        throw notFound({ data: { locale } });
      }
      return { kind: 'home', data: homeData } satisfies SingleSegmentRouteData;
    }

    const slugData = await loadSlugSurfaceData(defaultLocale, params.slug);
    if (!slugData) {
      throw notFound();
    }
    return { kind: 'slug', data: slugData } satisfies SingleSegmentRouteData;
  },
  head: ({ loaderData }) => {
    if (loaderData?.kind === 'home') {
      return getHomeSurfaceHead(loaderData.data);
    }
    return getSlugSurfaceHead(loaderData?.data ?? null);
  },
  component: SlugRoute,
});

function SlugRoute() {
  const routeData = Route.useLoaderData();
  return routeData.kind === 'home' ? (
    <HomeSurfaceView data={routeData.data} />
  ) : (
    <SlugSurfaceView data={routeData.data} />
  );
}
