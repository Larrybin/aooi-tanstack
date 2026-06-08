import type { MetadataRoute } from 'next';
import { site } from '@/site';

import { defaultLocale, locales } from '@/config/locale';

function stripTrailingSlash(value: string) {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values));
}

export default function robots(): MetadataRoute.Robots {
  const appUrl = stripTrailingSlash(site.brand.appUrl);
  const protectedRoots = ['/admin', '/settings', '/activity', '/chat'];

  const disallow = uniqueStrings([
    '/*?*q=',
    ...protectedRoots.flatMap((root) => {
      const localePrefixed = locales
        .filter((locale) => locale !== defaultLocale)
        .map((locale) => `/${locale}${root}`);

      return [
        root,
        `${root}/`,
        ...localePrefixed,
        ...localePrefixed.map((p) => `${p}/`),
      ];
    }),
  ]);

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow,
    },
    sitemap: `${appUrl}/sitemap.xml`,
  };
}
