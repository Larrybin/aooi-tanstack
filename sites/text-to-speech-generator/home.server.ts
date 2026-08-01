import { resolveTextToSpeechGeneratorHomeCopy } from '@/domains/text-to-speech-generator/ui/text-to-speech-home-copy';
import { buildTextToSpeechGeneratorHeaderFooter } from '@/domains/text-to-speech-generator/ui/text-to-speech-shell';
import { getServerPublicEnvConfigs } from '@/infra/runtime/env.server';
import {
  buildProductSiteHomeRouteData,
  resolvePublishedHomeLocale,
} from '@/server/landing/home-route-builders';
import { site, siteHomeContent } from '@/site';

function resolveProductHome(locale: string) {
  if (!(siteHomeContent as Readonly<Record<string, unknown>>)[locale])
    return null;
  return {
    copy: resolveTextToSpeechGeneratorHomeCopy(siteHomeContent, locale),
    turnstileSiteKey: getServerPublicEnvConfigs().turnstileSiteKey,
  };
}

export function resolveSiteHomeHeaderFooter(locale: string) {
  const productHome = resolveProductHome(locale);
  return productHome
    ? buildTextToSpeechGeneratorHeaderFooter(
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
