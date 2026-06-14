import type { ActivityRouteData } from './activity.types';

export function getActivityRouteSurfaceHead(data: ActivityRouteData | null) {
  return data?.head ?? {};
}
