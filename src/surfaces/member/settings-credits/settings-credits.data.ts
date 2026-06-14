import { loadSettingsCreditsRouteData } from '@/server/member/settings-credits-route-data';

import type { SettingsCreditsRouteData } from './settings-credits.types';

export async function loadSettingsCreditsRouteSurfaceData(input: {
  locale: string;
  search?: unknown;
}) {
  const data = await loadSettingsCreditsRouteData({
    data: input,
  });

  return data as SettingsCreditsRouteData | null;
}
