import { loadSlugRouteData } from '@/server/landing/slug-route-data';

import type { SlugRouteData } from './slug.types';

export async function loadSlugSurfaceData(locale: string, slug: string) {
  const data = await loadSlugRouteData({
    data: { locale, slug },
  });

  return data as SlugRouteData | null;
}
