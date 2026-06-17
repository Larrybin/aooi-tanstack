import { createServerFn } from '@tanstack/react-start';

type AdminRouteInput = {
  locale: string;
  splat?: string;
  search?: unknown;
};

export const loadAdminRouteData = createServerFn({ method: 'GET' })
  .validator((data: unknown): AdminRouteInput => {
    const input =
      data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
    return {
      locale: typeof input.locale === 'string' ? input.locale : '',
      splat: typeof input.splat === 'string' ? input.splat : '',
      search: input.search,
    };
  })
  .handler(async ({ data }) => {
    const { resolveAdminRouteData } = await import('./admin-route-resolver');
    return resolveAdminRouteData(data);
  });
