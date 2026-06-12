import { loadBlogCategorySurfaceData } from '@/surfaces/landing/blog-category/blog-category.data';
import { getBlogCategorySurfaceHead } from '@/surfaces/landing/blog-category/blog-category.seo';
import type { BlogCategoryRouteData } from '@/surfaces/landing/blog-category/blog-category.types';
import { BlogCategorySurfaceView } from '@/surfaces/landing/blog-category/blog-category.view';
import { createFileRoute, notFound } from '@tanstack/react-router';

import { defaultLocale } from '@/config/locale';

export const Route = createFileRoute('/blog/category/$slug')({
  loader: async ({ params }) => {
    const data = await loadBlogCategorySurfaceData(defaultLocale, params.slug);
    if (!data) {
      throw notFound({ data: { locale: defaultLocale } });
    }
    return data as BlogCategoryRouteData;
  },
  head: ({ loaderData, params }) =>
    getBlogCategorySurfaceHead(loaderData ?? null, {
      locale: defaultLocale,
      slug: params.slug,
    }),
  component: BlogCategoryRoute,
});

function BlogCategoryRoute() {
  const data = Route.useLoaderData();
  return <BlogCategorySurfaceView data={data} />;
}
