import { resolveMp4CompressorHomeCopy } from '@/domains/mp4-compressor/ui/mp4-compressor-home-copy';
import { buildMp4CompressorHeaderFooter } from '@/domains/mp4-compressor/ui/mp4-compressor-shell';
import {
  buildProductSiteHomeRouteData,
  resolvePublishedHomeLocale,
} from '@/server/landing/home-route-builders';
import { site, siteHomeContent } from '@/site';

function resolveProductHome(locale: string) {
  if (!(siteHomeContent as Readonly<Record<string, unknown>>)[locale])
    return null;
  return { copy: resolveMp4CompressorHomeCopy(siteHomeContent, locale) };
}

export function resolveSiteHomeHeaderFooter(locale: string) {
  const productHome = resolveProductHome(locale);
  return productHome
    ? buildMp4CompressorHeaderFooter(
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
  });
}

export type SiteHomeRouteData = NonNullable<
  ReturnType<typeof resolveSiteHomeRouteData>
>;
