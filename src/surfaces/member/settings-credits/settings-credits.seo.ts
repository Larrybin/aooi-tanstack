import type { SettingsCreditsRouteData } from './settings-credits.types';

export function getSettingsCreditsRouteSurfaceHead(
  data: SettingsCreditsRouteData | null
) {
  return (
    data?.head ?? { meta: [{ name: 'robots', content: 'noindex,nofollow' }] }
  );
}
