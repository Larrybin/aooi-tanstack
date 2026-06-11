import { createServerFn } from '@tanstack/react-start';

import { resolveSlugRouteData } from './slug-route-resolver';

type SlugRouteInput = {
  locale: string;
  slug: string;
};

export const loadSlugRouteData = createServerFn({ method: 'GET' })
  .validator((data: SlugRouteInput) => data)
  .handler(async ({ data }) => resolveSlugRouteData(data));
