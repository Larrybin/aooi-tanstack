import type { SettingsApiKeysIdRouteData } from './settings-apikeys-id.types';

export function getSettingsApiKeysIdRouteSurfaceHead(
  data: SettingsApiKeysIdRouteData | null
) {
  return (
    data?.head ?? { meta: [{ name: 'robots', content: 'noindex,nofollow' }] }
  );
}
