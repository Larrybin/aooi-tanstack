import { resolveRandomGroupGeneratorHomeCopy } from '@/domains/random-group-generator/ui/random-group-generator-home-copy';
import { buildRandomGroupGeneratorHeaderFooter } from '@/domains/random-group-generator/ui/random-group-generator-shell';
import { site, siteHomeContent } from '@/site';

export const isSiteProductHome = true;

export function resolveSiteProductHomeRouteData(locale: string) {
  if (!(siteHomeContent as Readonly<Record<string, unknown>>)[locale])
    return null;

  return {
    copy: resolveRandomGroupGeneratorHomeCopy(siteHomeContent, locale),
  };
}

export type SiteProductHomeRouteData = NonNullable<
  ReturnType<typeof resolveSiteProductHomeRouteData>
>;

export function buildSiteProductHomeHeaderFooter(
  productHome: SiteProductHomeRouteData
) {
  return buildRandomGroupGeneratorHeaderFooter(
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
