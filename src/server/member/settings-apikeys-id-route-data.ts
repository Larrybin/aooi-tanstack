import { createServerFn } from '@tanstack/react-start';

type SettingsApiKeysIdRouteInput = {
  locale: string;
  id: string;
  mode: 'edit' | 'delete';
};

type SettingsApiKeyUpdateInput = {
  locale: string;
  id: string;
  title: string;
};

type SettingsApiKeyDeleteInput = {
  locale: string;
  id: string;
  title: string;
};

export const loadSettingsApiKeysIdRouteData = createServerFn({ method: 'GET' })
  .validator((data: unknown): SettingsApiKeysIdRouteInput => {
    const input =
      data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
    const mode = input.mode === 'delete' ? 'delete' : 'edit';

    return {
      locale: typeof input.locale === 'string' ? input.locale : '',
      id: typeof input.id === 'string' ? input.id : '',
      mode,
    };
  })
  .handler(async ({ data }) => {
    const { resolveSettingsApiKeysIdRouteData } =
      await import('./settings-apikeys-id-route-resolver');

    return resolveSettingsApiKeysIdRouteData(data);
  });

export const submitSettingsApiKeyUpdateRouteData = createServerFn({
  method: 'POST',
})
  .validator((data: unknown): SettingsApiKeyUpdateInput => {
    const input =
      data && typeof data === 'object' ? (data as Record<string, unknown>) : {};

    return {
      locale: typeof input.locale === 'string' ? input.locale : '',
      id: typeof input.id === 'string' ? input.id : '',
      title: typeof input.title === 'string' ? input.title : '',
    };
  })
  .handler(async ({ data }) => {
    const { resolveSettingsApiKeyUpdate } =
      await import('./settings-apikeys-id-route-resolver');

    return resolveSettingsApiKeyUpdate(data);
  });

export const submitSettingsApiKeyDeleteRouteData = createServerFn({
  method: 'POST',
})
  .validator((data: unknown): SettingsApiKeyDeleteInput => {
    const input =
      data && typeof data === 'object' ? (data as Record<string, unknown>) : {};

    return {
      locale: typeof input.locale === 'string' ? input.locale : '',
      id: typeof input.id === 'string' ? input.id : '',
      title: typeof input.title === 'string' ? input.title : '',
    };
  })
  .handler(async ({ data }) => {
    const { resolveSettingsApiKeyDelete } =
      await import('./settings-apikeys-id-route-resolver');

    return resolveSettingsApiKeyDelete(data);
  });
