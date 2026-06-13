import type { SettingsSecurityRouteData } from './settings-security.types';

export function getSettingsSecurityRouteSurfaceHead(
  data: SettingsSecurityRouteData | null
) {
  return (
    data?.head ?? {
      meta: [{ name: 'robots', content: 'noindex,nofollow' }],
    }
  );
}
