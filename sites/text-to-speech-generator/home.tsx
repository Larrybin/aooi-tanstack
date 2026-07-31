import { TextToSpeechGeneratorHome } from '@/domains/text-to-speech-generator/ui/text-to-speech-home';
import { resolveTextToSpeechGeneratorHomeCopy } from '@/domains/text-to-speech-generator/ui/text-to-speech-home-copy';
import { buildTextToSpeechGeneratorHeaderFooter } from '@/domains/text-to-speech-generator/ui/text-to-speech-shell';
import { site } from '@/site';

export const isSiteProductHome = true;

export type SiteProductHomeRouteData = {
  copy: ReturnType<typeof resolveTextToSpeechGeneratorHomeCopy>;
  turnstileSiteKey: string;
};

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
  return (
    <TextToSpeechGeneratorHome
      copy={productHome.copy}
      locale={locale}
      turnstileSiteKey={productHome.turnstileSiteKey}
    />
  );
}
