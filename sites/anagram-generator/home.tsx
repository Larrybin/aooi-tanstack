import { AnagramGeneratorHome } from '@/domains/anagram-generator/ui/anagram-generator-home';
import { HomeLayoutView } from '@/surfaces/landing/home/home-layout.view';

import type { SiteHomeRouteData } from './home.server';

export function SiteHomeView({ data }: { data: SiteHomeRouteData }) {
  return (
    <HomeLayoutView data={data}>
      <AnagramGeneratorHome copy={data.productHome.copy} locale={data.locale} />
    </HomeLayoutView>
  );
}
