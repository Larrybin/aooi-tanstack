import { CalculatorHome } from '@/domains/401k-calculator/ui/401k-calculator-home';
import { HomeLayoutView } from '@/surfaces/landing/home/home-layout.view';

import type { SiteHomeRouteData } from './home.server';

export function SiteHomeView({ data }: { data: SiteHomeRouteData }) {
  return (
    <HomeLayoutView
      data={data}
      skipLink={{
        href: '#calculator',
        label: data.productHome.copy.shell.skipToCalculator,
      }}
    >
      <CalculatorHome copy={data.productHome.copy} locale={data.locale} />
    </HomeLayoutView>
  );
}
