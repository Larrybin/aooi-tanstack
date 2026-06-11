import { createServerFn } from '@tanstack/react-start';

import { resolveSlugRouteData } from './slug-route-resolver';

type SlugRouteInput = {
  locale: string;
  slug: string;
};

export const loadSlugRouteData = createServerFn({ method: 'GET' })
  .validator((data: unknown): SlugRouteInput => {
    const input =
      data && typeof data === 'object' ? (data as Record<string, unknown>) : {};

    return {
      locale: typeof input.locale === 'string' ? input.locale : '',
      slug: typeof input.slug === 'string' ? input.slug : '',
    };
  })
  .handler(async ({ data }) => resolveSlugRouteData(data));
