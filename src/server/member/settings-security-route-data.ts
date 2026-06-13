import { createServerFn } from '@tanstack/react-start';

type SettingsSecurityRouteInput = {
  locale: string;
};

export const loadSettingsSecurityRouteData = createServerFn({ method: 'GET' })
  .validator((data: unknown): SettingsSecurityRouteInput => {
    const input =
      data && typeof data === 'object' ? (data as Record<string, unknown>) : {};

    return {
      locale: typeof input.locale === 'string' ? input.locale : '',
    };
  })
  .handler(async ({ data }) => {
    const { resolveSettingsSecurityRouteData } =
      await import('./settings-security-route-resolver');

    return resolveSettingsSecurityRouteData(data);
  });
