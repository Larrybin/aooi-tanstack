import { loadBlogIndexRouteData } from '@/server/landing/blog-index-route-data';

import type { BlogIndexRouteData } from './blog-index.types';

export async function loadBlogIndexSurfaceData(locale: string) {
  const data = await loadBlogIndexRouteData({
    data: { locale },
  });

  return data as BlogIndexRouteData | null;
}
