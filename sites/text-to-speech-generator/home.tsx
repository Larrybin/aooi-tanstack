import { TextToSpeechGeneratorHome } from '@/domains/text-to-speech-generator/ui/text-to-speech-home';

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
  return (
    <TextToSpeechGeneratorHome
      copy={productHome.copy}
      locale={locale}
      turnstileSiteKey={productHome.turnstileSiteKey}
    />
  );
}
