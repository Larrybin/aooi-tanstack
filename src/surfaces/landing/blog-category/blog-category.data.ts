import { loadBlogCategoryRouteData } from '@/server/landing/blog-category-route-data';

import type { BlogCategoryRouteData } from './blog-category.types';

export async function loadBlogCategorySurfaceData(
  locale: string,
  slug: string
) {
  const data = await loadBlogCategoryRouteData({
    data: { locale, slug },
  });

  return data as BlogCategoryRouteData | null;
}
