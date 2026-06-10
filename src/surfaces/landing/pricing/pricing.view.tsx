import { useEffect } from 'react';
import { PricingSliceView } from '@/domains/pricing/ui/pricing-slice-view';

import { isRtlLocale } from '@/config/locale';

import type { PricingRouteData } from './pricing.types';

export function PricingSurfaceView({ data }: { data: PricingRouteData }) {
  useEffect(() => {
    document.documentElement.lang = data.locale;
    document.documentElement.dir = isRtlLocale(data.locale) ? 'rtl' : 'ltr';
  }, [data.locale]);

  return <PricingSliceView data={data} />;
}
