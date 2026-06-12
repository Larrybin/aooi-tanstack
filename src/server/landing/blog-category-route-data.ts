import { createServerFn } from '@tanstack/react-start';

type BlogCategoryRouteInput = {
  locale: string;
  slug: string;
};

export const loadBlogCategoryRouteData = createServerFn({ method: 'GET' })
  .validator((data: unknown): BlogCategoryRouteInput => {
    const input =
      data && typeof data === 'object' ? (data as Record<string, unknown>) : {};

    return {
      locale: typeof input.locale === 'string' ? input.locale : '',
      slug: typeof input.slug === 'string' ? input.slug : '',
    };
  })
  .handler(async ({ data }) => {
    const { resolveBlogCategoryRouteData } =
      await import('./blog-category-route-resolver');

    return resolveBlogCategoryRouteData(data);
  });
