import { loadActivityAiTaskRefreshRouteData as loadServerActivityAiTaskRefreshRouteData } from '@/server/member/activity-refresh-route-data';

import type { ActivityRefreshRouteData } from './activity-refresh.types';

export async function loadActivityRefreshRouteSurfaceData(input: {
  locale: string;
  id: string;
}) {
  const data = await loadServerActivityAiTaskRefreshRouteData({
    data: input,
  });

  return data as ActivityRefreshRouteData | null;
}
