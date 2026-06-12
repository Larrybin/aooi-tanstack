import { createServerFn } from '@tanstack/react-start';

import { resolveBlogPostRouteData } from './blog-post-route-resolver';

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
  .handler(async ({ data }) => resolveBlogPostRouteData(data));
