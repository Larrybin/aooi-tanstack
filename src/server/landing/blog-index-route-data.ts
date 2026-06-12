import { createServerFn } from '@tanstack/react-start';

type BlogIndexRouteInput = {
  locale: string;
};

export const loadBlogIndexRouteData = createServerFn({ method: 'GET' })
  .validator((data: unknown): BlogIndexRouteInput => {
    const input =
      data && typeof data === 'object' ? (data as Record<string, unknown>) : {};

    return {
      locale: typeof input.locale === 'string' ? input.locale : '',
    };
  })
  .handler(async ({ data }) => {
    const { resolveBlogIndexRouteData } =
      await import('./blog-index-route-resolver');

    return resolveBlogIndexRouteData(data);
  });
