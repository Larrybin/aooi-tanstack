import { loadHomeRouteData } from '@/server/landing/home-route-data';

export async function loadHomeSurfaceData(locale: string) {
  return loadHomeRouteData({
    data: { locale },
  });
}
