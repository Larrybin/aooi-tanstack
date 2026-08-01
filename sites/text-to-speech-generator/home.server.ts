import { resolveTextToSpeechGeneratorHomeCopy } from '@/domains/text-to-speech-generator/ui/text-to-speech-home-copy';
import { buildTextToSpeechGeneratorHeaderFooter } from '@/domains/text-to-speech-generator/ui/text-to-speech-shell';
import { getServerPublicEnvConfigs } from '@/infra/runtime/env.server';
import { site, siteHomeContent } from '@/site';

export const isSiteProductHome = true;

export type SiteProductHomeRouteData = {
  copy: ReturnType<typeof resolveTextToSpeechGeneratorHomeCopy>;
  turnstileSiteKey: string;
};

export function resolveSiteProductHomeRouteData(
  locale: string
): SiteProductHomeRouteData | null {
  if (!(siteHomeContent as Readonly<Record<string, unknown>>)[locale])
    return null;

  return {
    copy: resolveTextToSpeechGeneratorHomeCopy(siteHomeContent, locale),
    turnstileSiteKey: getServerPublicEnvConfigs().turnstileSiteKey,
  };
}

export function buildSiteProductHomeHeaderFooter(
  productHome: SiteProductHomeRouteData
) {
  return buildTextToSpeechGeneratorHeaderFooter(
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
