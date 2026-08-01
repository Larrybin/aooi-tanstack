import { resolveBackgroundRemoverHomeCopy } from '@/domains/background-remover/ui/background-remover-home-copy';
import { buildBackgroundRemoverHeaderFooter } from '@/domains/background-remover/ui/background-remover-shell';
import { site, siteHomeContent } from '@/site';

export const isSiteProductHome = true;

export function resolveSiteProductHomeRouteData(locale: string) {
  if (!(siteHomeContent as Readonly<Record<string, unknown>>)[locale])
    return null;

  return {
    copy: resolveBackgroundRemoverHomeCopy(siteHomeContent, locale),
  };
}

export type SiteProductHomeRouteData = NonNullable<
  ReturnType<typeof resolveSiteProductHomeRouteData>
>;

export function buildSiteProductHomeHeaderFooter(
  productHome: SiteProductHomeRouteData
) {
  return buildBackgroundRemoverHeaderFooter(
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
