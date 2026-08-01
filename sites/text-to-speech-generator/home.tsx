import { TextToSpeechGeneratorHome } from '@/domains/text-to-speech-generator/ui/text-to-speech-home';
import { HomeLayoutView } from '@/surfaces/landing/home/home-layout.view';

import type { SiteHomeRouteData } from './home.server';

export function SiteHomeView({ data }: { data: SiteHomeRouteData }) {
  return (
    <HomeLayoutView data={data}>
      <TextToSpeechGeneratorHome
        copy={data.productHome.copy}
        locale={data.locale}
        turnstileSiteKey={data.productHome.turnstileSiteKey}
      />
    </HomeLayoutView>
  );
}
