import { BackgroundRemoverHome } from '@/domains/background-remover/ui/background-remover-home';
import { Mp4CompressorHome } from '@/domains/mp4-compressor/ui/mp4-compressor-home';
import { RemoverHome } from '@/domains/remover/ui/remover-home';
import { TextToSpeechGeneratorHome } from '@/domains/text-to-speech-generator/ui/text-to-speech-home';

import type { ProductHomeRouteData } from './home.types';

export function ProductHomeView({
  productHome,
  locale,
}: {
  productHome: ProductHomeRouteData;
  locale: string;
}) {
  switch (productHome.kind) {
    case 'ai-remover':
      return (
        <RemoverHome
          copy={productHome.copy}
          locale={locale}
          signInCallbackPath="/activity/ai-tasks"
        />
      );
    case 'background-remover':
      return <BackgroundRemoverHome copy={productHome.copy} locale={locale} />;
    case 'text-to-speech-generator':
      return (
        <TextToSpeechGeneratorHome
          copy={productHome.copy}
          locale={locale}
          turnstileSiteKey={productHome.turnstileSiteKey}
        />
      );
    case 'mp4-compressor':
      return <Mp4CompressorHome copy={productHome.copy} locale={locale} />;
  }
}
