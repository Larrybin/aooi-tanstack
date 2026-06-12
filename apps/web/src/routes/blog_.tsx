import { loadBlogIndexSurfaceData } from '@/surfaces/landing/blog-index/blog-index.data';
import { getBlogIndexSurfaceHead } from '@/surfaces/landing/blog-index/blog-index.seo';
import type { BlogIndexRouteData } from '@/surfaces/landing/blog-index/blog-index.types';
import { BlogIndexSurfaceView } from '@/surfaces/landing/blog-index/blog-index.view';
import { createFileRoute, notFound } from '@tanstack/react-router';

import { defaultLocale } from '@/config/locale';

export const Route = createFileRoute('/blog_')({
  loader: async () => {
    const data = await loadBlogIndexSurfaceData(defaultLocale);
    if (!data) {
      throw notFound({ data: { locale: defaultLocale } });
    }
    return data as BlogIndexRouteData;
  },
  head: ({ loaderData }) =>
    getBlogIndexSurfaceHead(loaderData ?? null, { locale: defaultLocale }),
  component: BlogIndexRoute,
});

function BlogIndexRoute() {
  const data = Route.useLoaderData();
  return <BlogIndexSurfaceView data={data} />;
}
