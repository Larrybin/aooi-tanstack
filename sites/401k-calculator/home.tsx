import { CalculatorHome } from '@/domains/401k-calculator/ui/401k-calculator-home';

import type { SiteProductHomeRouteData } from './home.server';

export function getSiteProductHomeSkipLink(
  productHome: SiteProductHomeRouteData
) {
  return productHome.copy.shell.skipToCalculator;
}

export function SiteProductHomeView({
  productHome,
  locale,
}: {
  productHome: SiteProductHomeRouteData;
  locale: string;
}) {
  return <CalculatorHome copy={productHome.copy} locale={locale} />;
}
