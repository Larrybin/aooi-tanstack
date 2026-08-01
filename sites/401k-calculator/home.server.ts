import { resolveCalculatorHomeCopy } from '@/domains/401k-calculator/ui/401k-calculator-home-copy';
import { buildCalculatorStructuredData } from '@/domains/401k-calculator/ui/401k-calculator-seo';
import { buildCalculatorHeaderFooter } from '@/domains/401k-calculator/ui/401k-calculator-shell';
import {
  buildProductSiteHomeRouteData,
  resolvePublishedHomeLocale,
} from '@/server/landing/home-route-builders';
import { site, siteHomeContent } from '@/site';

function resolveProductHome(locale: string) {
  if (!(siteHomeContent as Readonly<Record<string, unknown>>)[locale])
    return null;
  return { copy: resolveCalculatorHomeCopy(siteHomeContent, locale) };
}

export function resolveSiteHomeHeaderFooter(locale: string) {
  const productHome = resolveProductHome(locale);
  return productHome
    ? buildCalculatorHeaderFooter(
        { appName: site.brand.appName, appLogo: site.brand.logo },
        productHome.copy.shell
      )
    : null;
}

export function resolveSiteHomeRouteData(localeInput: unknown) {
  const locale = resolvePublishedHomeLocale(localeInput);
  if (!locale) return null;
  const productHome = resolveProductHome(locale);
  const shell = resolveSiteHomeHeaderFooter(locale);
  if (!productHome || !shell) return null;

  return buildProductSiteHomeRouteData({
    locale,
    productHome,
    ...shell,
    metadata: productHome.copy.metadata,
    scripts: buildCalculatorStructuredData(
      productHome.copy,
      new URL('/', site.brand.appUrl).toString()
    ),
  });
}

export type SiteHomeRouteData = NonNullable<
  ReturnType<typeof resolveSiteHomeRouteData>
>;
