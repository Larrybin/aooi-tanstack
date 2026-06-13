import type { SettingsProfileRouteData } from './settings-profile.types';

export function getSettingsProfileRouteSurfaceHead(
  data: SettingsProfileRouteData | null
) {
  return (
    data?.head ?? { meta: [{ name: 'robots', content: 'noindex,nofollow' }] }
  );
}
