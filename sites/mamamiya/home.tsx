import type { SiteProductHomeRouteData } from './home.server';

export const getSiteProductHomeSkipLink = (
  _productHome: SiteProductHomeRouteData
) => null;
export const SiteProductHomeView = (_props: {
  productHome: SiteProductHomeRouteData;
  locale: string;
}) => null;
