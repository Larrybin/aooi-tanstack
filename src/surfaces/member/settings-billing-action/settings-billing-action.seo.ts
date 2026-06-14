import type { SettingsBillingActionRouteData } from './settings-billing-action.types';

export function getSettingsBillingActionRouteSurfaceHead(
  data: SettingsBillingActionRouteData | null
) {
  return (
    data?.head ?? { meta: [{ name: 'robots', content: 'noindex,nofollow' }] }
  );
}
