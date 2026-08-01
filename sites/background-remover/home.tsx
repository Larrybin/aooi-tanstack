import { BackgroundRemoverHome } from '@/domains/background-remover/ui/background-remover-home';

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
  return <BackgroundRemoverHome copy={productHome.copy} locale={locale} />;
}
