import { Mp4CompressorHome } from '@/domains/mp4-compressor/ui/mp4-compressor-home';
import { resolveMp4CompressorHomeCopy } from '@/domains/mp4-compressor/ui/mp4-compressor-home-copy';
import { buildMp4CompressorHeaderFooter } from '@/domains/mp4-compressor/ui/mp4-compressor-shell';
import { site, siteHomeContent } from '@/site';

export const isSiteProductHome = true;

export function resolveSiteProductHomeRouteData(locale: string) {
  if (!(siteHomeContent as Readonly<Record<string, unknown>>)[locale])
    return null;
  return { copy: resolveMp4CompressorHomeCopy(siteHomeContent, locale) };
}

export type SiteProductHomeRouteData = NonNullable<
  ReturnType<typeof resolveSiteProductHomeRouteData>
>;

export function buildSiteProductHomeHeaderFooter(
  productHome: SiteProductHomeRouteData
) {
  return buildMp4CompressorHeaderFooter(
    { appName: site.brand.appName, appLogo: site.brand.logo },
    productHome.copy.shell
  );
}

export const getSiteProductHomeMetadata = (
  productHome: SiteProductHomeRouteData
) => productHome.copy.metadata;
export const getSiteProductHomeStructuredData = (
  _productHome: SiteProductHomeRouteData,
  _canonical: string
) => undefined;
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
