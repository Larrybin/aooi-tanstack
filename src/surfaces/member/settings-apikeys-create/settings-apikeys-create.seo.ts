import type { SettingsApiKeysCreateRouteData } from './settings-apikeys-create.types';

export function getSettingsApiKeysCreateRouteSurfaceHead(
  data: SettingsApiKeysCreateRouteData | null
) {
  return (
    data?.head ?? { meta: [{ name: 'robots', content: 'noindex,nofollow' }] }
  );
}
