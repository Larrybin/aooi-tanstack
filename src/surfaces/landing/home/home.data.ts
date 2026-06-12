import { loadHomeRouteData } from '@/server/landing/home-route-data';

import type { HomeRouteData } from './home.types';

export async function loadHomeSurfaceData(locale: string) {
  const data = await loadHomeRouteData({
    data: { locale },
  });

  return data as HomeRouteData | null;
}
