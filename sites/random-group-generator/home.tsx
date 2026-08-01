import { RandomGroupGeneratorHome } from '@/domains/random-group-generator/ui/random-group-generator-home';

import type { SiteProductHomeRouteData } from './home.server';

export const getSiteProductHomeSkipLink = (
  _productHome: SiteProductHomeRouteData
) => null;

export function SiteProductHomeView({
  productHome,
  locale,
}: {
  productHome: SiteProductHomeRouteData;
  locale: string;
}) {
  return <RandomGroupGeneratorHome copy={productHome.copy} locale={locale} />;
}
