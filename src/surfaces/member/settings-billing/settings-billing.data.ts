import { loadSettingsBillingRouteData } from '@/server/member/settings-billing-route-data';

import type { SettingsBillingRouteData } from './settings-billing.types';

export async function loadSettingsBillingRouteSurfaceData(input: {
  locale: string;
  search?: unknown;
}) {
  const data = await loadSettingsBillingRouteData({
    data: input,
  });

  return data as SettingsBillingRouteData | null;
}
