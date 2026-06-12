import { loadBlogIndexSurfaceData } from '@/surfaces/landing/blog-index/blog-index.data';
import { getBlogIndexSurfaceHead } from '@/surfaces/landing/blog-index/blog-index.seo';
import type { BlogIndexRouteData } from '@/surfaces/landing/blog-index/blog-index.types';
import { BlogIndexSurfaceView } from '@/surfaces/landing/blog-index/blog-index.view';
import { createFileRoute, notFound } from '@tanstack/react-router';

export const Route = createFileRoute('/$locale/blog_')({
  loader: async ({ params }) => {
    const data = await loadBlogIndexSurfaceData(params.locale);
    if (!data) {
      throw notFound({ data: { locale: params.locale } });
    }
    return data as BlogIndexRouteData;
  },
  head: ({ loaderData, params }) =>
    getBlogIndexSurfaceHead(loaderData ?? null, params),
  component: BlogIndexRoute,
});

function BlogIndexRoute() {
  const data = Route.useLoaderData();
  return <BlogIndexSurfaceView data={data} />;
}
