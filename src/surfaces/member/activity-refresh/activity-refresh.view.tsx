import { useEffect } from 'react';

import { isRtlLocale } from '@/config/locale';

import type { ActivityRefreshRouteData } from './activity-refresh.types';

export function ActivityRefreshRouteView({
  data,
}: {
  data: ActivityRefreshRouteData;
}) {
  useEffect(() => {
    document.documentElement.lang = data.locale;
    document.documentElement.dir = isRtlLocale(data.locale) ? 'rtl' : 'ltr';
  }, [data.locale]);

  return (
    <section className="settings-panel">
      <h1>{data.page.title}</h1>
      <p>{data.page.message}</p>
      <a href={data.page.backHref}>{data.page.backLabel}</a>
    </section>
  );
}
