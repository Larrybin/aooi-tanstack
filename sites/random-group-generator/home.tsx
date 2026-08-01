import { RandomGroupGeneratorHome } from '@/domains/random-group-generator/ui/random-group-generator-home';
import { HomeLayoutView } from '@/surfaces/landing/home/home-layout.view';

import type { SiteHomeRouteData } from './home.server';

export function SiteHomeView({ data }: { data: SiteHomeRouteData }) {
  return (
    <HomeLayoutView data={data}>
      <RandomGroupGeneratorHome
        copy={data.productHome.copy}
        locale={data.locale}
      />
    </HomeLayoutView>
  );
}
