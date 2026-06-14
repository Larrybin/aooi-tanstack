import { createServerFn } from '@tanstack/react-start';

type SettingsApiKeysCreateRouteInput = {
  locale: string;
};

type SettingsApiKeyCreateInput = {
  locale: string;
  title: string;
};

export const loadSettingsApiKeysCreateRouteData = createServerFn({
  method: 'GET',
})
  .validator((data: unknown): SettingsApiKeysCreateRouteInput => {
    const input =
      data && typeof data === 'object' ? (data as Record<string, unknown>) : {};

    return {
      locale: typeof input.locale === 'string' ? input.locale : '',
    };
  })
  .handler(async ({ data }) => {
    const { resolveSettingsApiKeysCreateRouteData } =
      await import('./settings-apikeys-create-route-resolver');

    return resolveSettingsApiKeysCreateRouteData(data);
  });

export const submitSettingsApiKeyCreateRouteData = createServerFn({
  method: 'POST',
})
  .validator((data: unknown): SettingsApiKeyCreateInput => {
    const input =
      data && typeof data === 'object' ? (data as Record<string, unknown>) : {};

    return {
      locale: typeof input.locale === 'string' ? input.locale : '',
      title: typeof input.title === 'string' ? input.title : '',
    };
  })
  .handler(async ({ data }) => {
    const { resolveSettingsApiKeyCreate } =
      await import('./settings-apikeys-create-route-resolver');

    return resolveSettingsApiKeyCreate(data);
  });
