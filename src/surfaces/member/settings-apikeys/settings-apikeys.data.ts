import { loadSettingsApiKeysRouteData } from '@/server/member/settings-apikeys-route-data';

import type { SettingsApiKeysRouteData } from './settings-apikeys.types';

export async function loadSettingsApiKeysRouteSurfaceData(input: {
  locale: string;
  search?: unknown;
}) {
  const data = await loadSettingsApiKeysRouteData({
    data: input,
  });

  return data as SettingsApiKeysRouteData | null;
}
