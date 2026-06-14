import type { SettingsApiKeysRouteData } from './settings-apikeys.types';

export function getSettingsApiKeysRouteSurfaceHead(
  data: SettingsApiKeysRouteData | null
) {
  return (
    data?.head ?? { meta: [{ name: 'robots', content: 'noindex,nofollow' }] }
  );
}
