import { lazy, Suspense } from 'react';

import type { ProductHomeRouteData } from './home.types';

const CalculatorHome = lazy(() =>
  import('@/domains/401k-calculator/ui/401k-calculator-home').then(
    ({ CalculatorHome }) => ({ default: CalculatorHome })
  )
);
const RemoverHome = lazy(() =>
  import('@/domains/remover/ui/remover-home').then(({ RemoverHome }) => ({
    default: RemoverHome,
  }))
);
const BackgroundRemoverHome = lazy(() =>
  import('@/domains/background-remover/ui/background-remover-home').then(
    ({ BackgroundRemoverHome }) => ({ default: BackgroundRemoverHome })
  )
);
const TextToSpeechGeneratorHome = lazy(() =>
  import('@/domains/text-to-speech-generator/ui/text-to-speech-home').then(
    ({ TextToSpeechGeneratorHome }) => ({
      default: TextToSpeechGeneratorHome,
    })
  )
);
const Mp4CompressorHome = lazy(() =>
  import('@/domains/mp4-compressor/ui/mp4-compressor-home').then(
    ({ Mp4CompressorHome }) => ({ default: Mp4CompressorHome })
  )
);
const RandomGroupGeneratorHome = lazy(() =>
  import('@/domains/random-group-generator/ui/random-group-generator-home').then(
    ({ RandomGroupGeneratorHome }) => ({
      default: RandomGroupGeneratorHome,
    })
  )
);

export function ProductHomeView({
  productHome,
  locale,
}: {
  productHome: ProductHomeRouteData;
  locale: string;
}) {
  switch (productHome.kind) {
    case '401k-calculator':
      return (
        <Suspense fallback={null}>
          <CalculatorHome copy={productHome.copy} locale={locale} />
        </Suspense>
      );
    case 'ai-remover':
      return (
        <Suspense fallback={null}>
          <RemoverHome
            copy={productHome.copy}
            locale={locale}
            signInCallbackPath="/activity/ai-tasks"
          />
        </Suspense>
      );
    case 'background-remover':
      return (
        <Suspense fallback={null}>
          <BackgroundRemoverHome copy={productHome.copy} locale={locale} />
        </Suspense>
      );
    case 'text-to-speech-generator':
      return (
        <Suspense fallback={null}>
          <TextToSpeechGeneratorHome
            copy={productHome.copy}
            locale={locale}
            turnstileSiteKey={productHome.turnstileSiteKey}
          />
        </Suspense>
      );
    case 'mp4-compressor':
      return (
        <Suspense fallback={null}>
          <Mp4CompressorHome copy={productHome.copy} locale={locale} />
        </Suspense>
      );
    case 'random-group-generator':
      return (
        <Suspense fallback={null}>
          <RandomGroupGeneratorHome copy={productHome.copy} locale={locale} />
        </Suspense>
      );
  }
}
