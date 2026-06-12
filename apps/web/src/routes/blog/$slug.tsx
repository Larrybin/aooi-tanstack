import { loadBlogPostSurfaceData } from '@/surfaces/landing/blog-post/blog-post.data';
import { getBlogPostSurfaceHead } from '@/surfaces/landing/blog-post/blog-post.seo';
import type { BlogPostRouteData } from '@/surfaces/landing/blog-post/blog-post.types';
import { BlogPostSurfaceView } from '@/surfaces/landing/blog-post/blog-post.view';
import { createFileRoute, notFound } from '@tanstack/react-router';

import { defaultLocale } from '@/config/locale';

export const Route = createFileRoute('/blog/$slug')({
  loader: async ({ params }) => {
    const data = await loadBlogPostSurfaceData(defaultLocale, params.slug);
    if (!data) {
      throw notFound({ data: { locale: defaultLocale } });
    }
    return data as BlogPostRouteData;
  },
  head: ({ loaderData, params }) =>
    getBlogPostSurfaceHead(loaderData ?? null, {
      locale: defaultLocale,
      slug: params.slug,
    }),
  component: BlogPostRoute,
});

function BlogPostRoute() {
  const data = Route.useLoaderData();
  return <BlogPostSurfaceView data={data} />;
}
