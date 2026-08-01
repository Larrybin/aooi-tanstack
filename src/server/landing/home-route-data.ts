import type { SiteHomeRouteData } from '@/site-home-server';
import { createServerFn } from '@tanstack/react-start';

type HomeRouteInput = {
  locale: string;
};

export const loadHomeRouteData = createServerFn({ method: 'GET' })
  .validator((data: unknown): HomeRouteInput => {
    const input =
      data && typeof data === 'object' ? (data as Record<string, unknown>) : {};

    return {
      locale: typeof input.locale === 'string' ? input.locale : '',
    };
  })
  .handler(async ({ data }): Promise<SiteHomeRouteData | null> => {
    const { resolveSiteHomeRouteData } = await import('@/site-home-server');
    return resolveSiteHomeRouteData(data.locale);
  });
