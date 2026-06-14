import { createServerFn } from '@tanstack/react-start';

type SettingsCreditsRouteInput = {
  locale: string;
  search?: unknown;
};

export const loadSettingsCreditsRouteData = createServerFn({ method: 'GET' })
  .validator((data: unknown): SettingsCreditsRouteInput => {
    const input =
      data && typeof data === 'object' ? (data as Record<string, unknown>) : {};

    return {
      locale: typeof input.locale === 'string' ? input.locale : '',
      search: input.search,
    };
  })
  .handler(async ({ data }) => {
    const { resolveSettingsCreditsRouteData } =
      await import('./settings-credits-route-resolver');

    return resolveSettingsCreditsRouteData(data);
  });
