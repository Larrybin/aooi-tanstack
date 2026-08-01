import { Mp4CompressorHome } from '@/domains/mp4-compressor/ui/mp4-compressor-home';

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
  return <Mp4CompressorHome copy={productHome.copy} locale={locale} />;
}
