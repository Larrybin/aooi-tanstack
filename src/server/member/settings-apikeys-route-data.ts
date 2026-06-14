import { createServerFn } from '@tanstack/react-start';

type SettingsApiKeysRouteInput = {
  locale: string;
  search?: unknown;
};

export const loadSettingsApiKeysRouteData = createServerFn({ method: 'GET' })
  .validator((data: unknown): SettingsApiKeysRouteInput => {
    const input =
      data && typeof data === 'object' ? (data as Record<string, unknown>) : {};

    return {
      locale: typeof input.locale === 'string' ? input.locale : '',
      search: input.search,
    };
  })
  .handler(async ({ data }) => {
    const { resolveSettingsApiKeysRouteData } =
      await import('./settings-apikeys-route-resolver');

    return resolveSettingsApiKeysRouteData(data);
  });
