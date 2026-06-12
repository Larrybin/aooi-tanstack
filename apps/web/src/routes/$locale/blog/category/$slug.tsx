import { loadBlogCategorySurfaceData } from '@/surfaces/landing/blog-category/blog-category.data';
import { getBlogCategorySurfaceHead } from '@/surfaces/landing/blog-category/blog-category.seo';
import type { BlogCategoryRouteData } from '@/surfaces/landing/blog-category/blog-category.types';
import { BlogCategorySurfaceView } from '@/surfaces/landing/blog-category/blog-category.view';
import { createFileRoute, notFound } from '@tanstack/react-router';

export const Route = createFileRoute('/$locale/blog/category/$slug')({
  loader: async ({ params }) => {
    const data = await loadBlogCategorySurfaceData(params.locale, params.slug);
    if (!data) {
      throw notFound({ data: { locale: params.locale } });
    }
    return data as BlogCategoryRouteData;
  },
  head: ({ loaderData, params }) =>
    getBlogCategorySurfaceHead(loaderData ?? null, params),
  component: BlogCategoryRoute,
});

function BlogCategoryRoute() {
  const data = Route.useLoaderData();
  return <BlogCategorySurfaceView data={data} />;
}
