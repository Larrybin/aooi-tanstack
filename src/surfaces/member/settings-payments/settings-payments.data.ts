import { loadSettingsPaymentsRouteData } from '@/server/member/settings-payments-route-data';

import type { SettingsPaymentsRouteData } from './settings-payments.types';

export async function loadSettingsPaymentsRouteSurfaceData(input: {
  locale: string;
  search?: unknown;
}) {
  const data = await loadSettingsPaymentsRouteData({
    data: input,
  });

  return data as SettingsPaymentsRouteData | null;
}
