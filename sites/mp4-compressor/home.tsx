import { Mp4CompressorHome } from '@/domains/mp4-compressor/ui/mp4-compressor-home';
import { HomeLayoutView } from '@/surfaces/landing/home/home-layout.view';

import type { SiteHomeRouteData } from './home.server';

export function SiteHomeView({ data }: { data: SiteHomeRouteData }) {
  return (
    <HomeLayoutView data={data}>
      <Mp4CompressorHome copy={data.productHome.copy} locale={data.locale} />
    </HomeLayoutView>
  );
}
