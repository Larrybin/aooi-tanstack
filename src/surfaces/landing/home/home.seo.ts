import { site } from '@/site';

import {
  buildCanonicalUrl,
  buildLanguageAlternates,
  buildSeoHead,
} from '@/shared/seo/canonical';

import type { HomeRouteData } from './home.types';

export function getHomeSurfaceHead(data: HomeRouteData | null) {
  if (data) {
    return data.head;
  }

  const canonical = buildCanonicalUrl('/');
  const head = buildSeoHead({
    title: site.brand.appName,
    description: `${site.brand.appName} home page`,
    canonical,
    alternates: buildLanguageAlternates('/'),
    locale: site.i18n.defaultLocale,
    siteName: site.brand.appName,
  });

  return {
    ...head,
    meta: [
      ...(head.meta ?? []),
      { name: 'robots', content: 'noindex,nofollow' },
    ],
  };
}
