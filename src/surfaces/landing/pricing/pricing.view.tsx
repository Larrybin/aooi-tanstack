import { useEffect } from 'react';
import { PricingSliceView } from '@/domains/pricing/ui/pricing-slice-view';

import { isRtlLocale } from '@/config/locale';

import { LandingShellView } from '../shell/landing-shell.view';
import type { PricingRouteData } from './pricing.types';

export function PricingSurfaceView({ data }: { data: PricingRouteData }) {
  useEffect(() => {
    document.documentElement.lang = data.locale;
    document.documentElement.dir = isRtlLocale(data.locale) ? 'rtl' : 'ltr';
  }, [data.locale]);

  return (
    <LandingShellView shell={data.shell}>
      <PricingSliceView data={data} />
    </LandingShellView>
  );
}
