import type { SettingsBillingRouteData } from './settings-billing.types';

export function getSettingsBillingRouteSurfaceHead(
  data: SettingsBillingRouteData | null
) {
  return (
    data?.head ?? { meta: [{ name: 'robots', content: 'noindex,nofollow' }] }
  );
}
