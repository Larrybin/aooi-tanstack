import { BackgroundRemoverHome } from '@/domains/background-remover/ui/background-remover-home';
import { HomeLayoutView } from '@/surfaces/landing/home/home-layout.view';

import type { SiteHomeRouteData } from './home.server';

export function SiteHomeView({ data }: { data: SiteHomeRouteData }) {
  return (
    <HomeLayoutView data={data}>
      <BackgroundRemoverHome
        copy={data.productHome.copy}
        locale={data.locale}
      />
    </HomeLayoutView>
  );
}
