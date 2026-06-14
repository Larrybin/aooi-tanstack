import { createServerFn } from '@tanstack/react-start';

type SettingsPaymentsRouteInput = {
  locale: string;
  search?: unknown;
};

export const loadSettingsPaymentsRouteData = createServerFn({ method: 'GET' })
  .validator((data: unknown): SettingsPaymentsRouteInput => {
    const input =
      data && typeof data === 'object' ? (data as Record<string, unknown>) : {};

    return {
      locale: typeof input.locale === 'string' ? input.locale : '',
      search: input.search,
    };
  })
  .handler(async ({ data }) => {
    const { resolveSettingsPaymentsRouteData } =
      await import('./settings-payments-route-resolver');

    return resolveSettingsPaymentsRouteData(data);
  });
