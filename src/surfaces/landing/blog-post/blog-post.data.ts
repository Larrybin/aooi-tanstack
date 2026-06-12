import { loadBlogPostRouteData } from '@/server/landing/blog-post-route-data';

import type { BlogPostRouteData } from './blog-post.types';

export async function loadBlogPostSurfaceData(locale: string, slug: string) {
  const data = await loadBlogPostRouteData({
    data: { locale, slug },
  });

  return data as BlogPostRouteData | null;
}
