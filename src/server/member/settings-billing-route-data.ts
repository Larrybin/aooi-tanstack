import { createServerFn } from '@tanstack/react-start';

type SettingsBillingRouteInput = {
  locale: string;
  search?: unknown;
};

export const loadSettingsBillingRouteData = createServerFn({ method: 'GET' })
  .validator((data: unknown): SettingsBillingRouteInput => {
    const input =
      data && typeof data === 'object' ? (data as Record<string, unknown>) : {};

    return {
      locale: typeof input.locale === 'string' ? input.locale : '',
      search: input.search,
    };
  })
  .handler(async ({ data }) => {
    const { resolveSettingsBillingRouteData } =
      await import('./settings-billing-route-resolver');

    return resolveSettingsBillingRouteData(data);
  });
