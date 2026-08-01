import { resolveGenericSiteHomeRouteData } from '@/server/landing/home-route-builders';
import type { GenericHomeRouteData } from '@/surfaces/landing/home/home.contracts';

export type SiteHomeRouteData = GenericHomeRouteData;

export const resolveSiteHomeRouteData = resolveGenericSiteHomeRouteData;

export function resolveSiteHomeHeaderFooter(_locale: string) {
  return null;
}
