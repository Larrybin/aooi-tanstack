import { loadActivityRouteData as loadServerActivityRouteData } from '@/server/member/activity-route-data';

import type { ActivityRouteData, ActivityRouteKind } from './activity.types';

export async function loadActivityRouteSurfaceData(input: {
  locale: string;
  kind: ActivityRouteKind;
  search?: unknown;
}) {
  const data = await loadServerActivityRouteData({
    data: input,
  });

  return data as ActivityRouteData | null;
}
