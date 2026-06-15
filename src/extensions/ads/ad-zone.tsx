
import { getAdsRuntimeCached } from '@/infra/adapters/ads/service';

import { cn } from '@/shared/lib/utils';

import type { AdsZoneName } from './types';
import { ADS_ZONES, getAdsZoneContext } from './zones';

export async function AdZone({
  zone,
  className,
  containerClassName,
}: {
  zone: AdsZoneName;
  className?: string;
  containerClassName?: string;
}) {
  const runtime = await getAdsRuntimeCached();
  if (!runtime.enabled || !runtime.provider.supportsZone(zone)) {
    return null;
  }

  const content = runtime.provider.renderZone(getAdsZoneContext(zone));
  if (!content) {
    return null;
  }

  return (
    <section className={className} data-ad-zone={zone}>
      <div className={containerClassName}>
        <div className="border-border/70 bg-muted/25 rounded-[1.5rem] border px-4 py-4 shadow-sm md:px-6 md:py-5">
          <div className="text-muted-foreground mb-3 text-[11px] font-semibold tracking-[0.18em] uppercase">
            Sponsored · {ADS_ZONES[zone].title}
          </div>
          <div
            className={cn(
              'bg-background/70 min-h-[120px] w-full overflow-hidden rounded-[1rem]'
            )}
          >
            {content}
          </div>
        </div>
      </div>
    </section>
  );
}
