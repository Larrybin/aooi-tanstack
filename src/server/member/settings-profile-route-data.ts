import { createServerFn } from '@tanstack/react-start';

type SettingsProfileRouteInput = {
  locale: string;
};

type SettingsProfileUpdateInput = {
  locale: string;
  name: string;
  image: string;
};

export const loadSettingsProfileRouteData = createServerFn({ method: 'GET' })
  .validator((data: unknown): SettingsProfileRouteInput => {
    const input =
      data && typeof data === 'object' ? (data as Record<string, unknown>) : {};

    return {
      locale: typeof input.locale === 'string' ? input.locale : '',
    };
  })
  .handler(async ({ data }) => {
    const { resolveSettingsProfileRouteData } =
      await import('./settings-profile-route-resolver');

    return resolveSettingsProfileRouteData(data);
  });

export const submitSettingsProfileRouteData = createServerFn({ method: 'POST' })
  .validator((data: unknown): SettingsProfileUpdateInput => {
    const input =
      data && typeof data === 'object' ? (data as Record<string, unknown>) : {};

    return {
      locale: typeof input.locale === 'string' ? input.locale : '',
      name: typeof input.name === 'string' ? input.name : '',
      image: typeof input.image === 'string' ? input.image : '',
    };
  })
  .handler(async ({ data }) => {
    const { resolveSettingsProfileUpdate } =
      await import('./settings-profile-route-resolver');

    return resolveSettingsProfileUpdate(data);
  });
