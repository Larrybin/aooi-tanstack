import { RemoverHome } from '@/domains/remover/ui/remover-home';
import { HomeLayoutView } from '@/surfaces/landing/home/home-layout.view';

import type { SiteHomeRouteData } from './home.server';

export function SiteHomeView({ data }: { data: SiteHomeRouteData }) {
  return (
    <HomeLayoutView data={data}>
      <RemoverHome
        copy={data.productHome.copy}
        locale={data.locale}
        signInCallbackPath="/activity/ai-tasks"
      />
    </HomeLayoutView>
  );
}
