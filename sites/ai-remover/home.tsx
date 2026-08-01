import { RemoverHome } from '@/domains/remover/ui/remover-home';

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
    <RemoverHome
      copy={productHome.copy}
      locale={locale}
      signInCallbackPath="/activity/ai-tasks"
    />
  );
}
