import { createServerFn } from '@tanstack/react-start';

import { defaultLocale } from '@/config/locale';

export type { MyImagesRouteData } from './my-images-route-resolver';

export const loadMyImagesRouteData = createServerFn({ method: 'GET' })
  .validator((data: unknown) => {
    const input =
      data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
    return {
      locale: typeof input.locale === 'string' ? input.locale : defaultLocale,
    };
  })
  .handler(async ({ data }) => {
    const { resolveMyImagesRouteData } =
      await import('./my-images-route-resolver');
    return resolveMyImagesRouteData(data);
  });
