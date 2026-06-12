import { createServerFn } from '@tanstack/react-start';

type BlogPostRouteInput = {
  locale: string;
  slug: string;
};

export const loadBlogPostRouteData = createServerFn({ method: 'GET' })
  .validator((data: unknown): BlogPostRouteInput => {
    const input =
      data && typeof data === 'object' ? (data as Record<string, unknown>) : {};

    return {
      locale: typeof input.locale === 'string' ? input.locale : '',
      slug: typeof input.slug === 'string' ? input.slug : '',
    };
  })
  .handler(async ({ data }) => {
    const { resolveBlogPostRouteData } = await import(
      './blog-post-route-resolver'
    );

    return resolveBlogPostRouteData(data);
  });
