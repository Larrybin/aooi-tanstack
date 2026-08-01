import { GenericHomeView } from '@/surfaces/landing/home/generic-home.view';

import type { SiteHomeRouteData } from './home.server';

export function SiteHomeView({ data }: { data: SiteHomeRouteData }) {
  return <GenericHomeView data={data} />;
}
