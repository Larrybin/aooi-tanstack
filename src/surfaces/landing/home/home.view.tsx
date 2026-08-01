import { SiteHomeView } from '@/site-home';

import type { HomeRouteData } from './home.types';

export function HomeSurfaceView({ data }: { data: HomeRouteData }) {
  return <SiteHomeView data={data} />;
}
