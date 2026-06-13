import { loadAuthRouteData } from '@/server/auth/auth-route-data';

import type { AuthRouteData, AuthRouteMode } from './auth-route.types';

export async function loadAuthRouteSurfaceData(input: {
  locale: string;
  mode: AuthRouteMode;
  search?: unknown;
}) {
  const data = await loadAuthRouteData({
    data: input,
  });

  return data as AuthRouteData | null;
}
