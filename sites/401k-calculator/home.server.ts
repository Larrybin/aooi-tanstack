import { resolveCalculatorHomeCopy } from '@/domains/401k-calculator/ui/401k-calculator-home-copy';
import { buildCalculatorStructuredData } from '@/domains/401k-calculator/ui/401k-calculator-seo';
import { buildCalculatorHeaderFooter } from '@/domains/401k-calculator/ui/401k-calculator-shell';
import { site, siteHomeContent } from '@/site';

export const isSiteProductHome = true;

export function resolveSiteProductHomeRouteData(locale: string) {
  if (!(siteHomeContent as Readonly<Record<string, unknown>>)[locale])
    return null;

  return {
    copy: resolveCalculatorHomeCopy(siteHomeContent, locale),
  };
}

export type SiteProductHomeRouteData = NonNullable<
  ReturnType<typeof resolveSiteProductHomeRouteData>
>;

export function buildSiteProductHomeHeaderFooter(
  productHome: SiteProductHomeRouteData
) {
  return buildCalculatorHeaderFooter(
    { appName: site.brand.appName, appLogo: site.brand.logo },
    productHome.copy.shell
  );
}

export function getSiteProductHomeMetadata(
  productHome: SiteProductHomeRouteData
) {
  return productHome.copy.metadata;
}

export function getSiteProductHomeStructuredData(
  productHome: SiteProductHomeRouteData,
  canonical: string
) {
  return buildCalculatorStructuredData(productHome.copy, canonical);
}
