import type { SettingsPaymentsRouteData } from './settings-payments.types';

export function getSettingsPaymentsRouteSurfaceHead(
  data: SettingsPaymentsRouteData | null
) {
  return (
    data?.head ?? { meta: [{ name: 'robots', content: 'noindex,nofollow' }] }
  );
}
