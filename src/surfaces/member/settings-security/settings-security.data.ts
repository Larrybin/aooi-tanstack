import { loadSettingsSecurityRouteData } from '@/server/member/settings-security-route-data';

import type { SettingsSecurityRouteData } from './settings-security.types';

export async function loadSettingsSecurityRouteSurfaceData(input: {
  locale: string;
}) {
  const data = await loadSettingsSecurityRouteData({
    data: input,
  });

  return data as SettingsSecurityRouteData | null;
}
