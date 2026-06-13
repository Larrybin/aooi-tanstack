import type { PricingPageData } from '@/domains/pricing/application/pricing-page';

import type { SlugShellData } from '../slug/slug.types';

export type PricingRouteData = PricingPageData & {
  shell: SlugShellData;
};
