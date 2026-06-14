import type { ActivityRefreshRouteData } from './activity-refresh.types';

export function getActivityRefreshRouteSurfaceHead(
  data: ActivityRefreshRouteData | null
) {
  return data?.head ?? {};
}
