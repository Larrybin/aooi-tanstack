import { createServerFn } from '@tanstack/react-start';

type AdminRouteInput = {
  locale: string;
  splat?: string;
  search?: unknown;
};

type AdminSettingsUpdateInput = {
  locale: string;
  values: Record<string, string>;
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

export const submitAdminSettingsRouteData = createServerFn({ method: 'POST' })
  .validator((data: unknown): AdminSettingsUpdateInput => {
    const input =
      data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
    const rawValues =
      input.values &&
      typeof input.values === 'object' &&
      !Array.isArray(input.values)
        ? (input.values as Record<string, unknown>)
        : {};
    const values = Object.fromEntries(
      Object.entries(rawValues).map(([key, value]) => [
        key,
        typeof value === 'string' ? value : String(value ?? ''),
      ])
    );

    return {
      locale: typeof input.locale === 'string' ? input.locale : '',
      values,
    };
  })
  .handler(async ({ data }) => {
    const { resolveAdminSettingsUpdate } =
      await import('./admin-route-resolver');
    return resolveAdminSettingsUpdate(data);
  });
