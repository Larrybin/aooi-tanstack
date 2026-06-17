import { site } from '@/site';
import { createFileRoute } from '@tanstack/react-router';

import { defaultLocale, locales } from '@/config/locale';

function stripTrailingSlash(value: string) {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values));
}

function buildRobotsTxt() {
  const appUrl = stripTrailingSlash(site.brand.appUrl);
  const protectedRoots = ['/admin', '/settings', '/activity', '/chat', '/my-images'];
  const disallow = uniqueStrings([
    '/*?*q=',
    ...protectedRoots.flatMap((root) => {
      const localePrefixed = locales
        .filter((locale) => locale !== defaultLocale)
        .map((locale) => `/${locale}${root}`);
      return [root, `${root}/`, ...localePrefixed, ...localePrefixed.map((p) => `${p}/`)];
    }),
  ]);

  return [
    'User-agent: *',
    'Allow: /',
    ...disallow.map((path) => `Disallow: ${path}`),
    `Sitemap: ${appUrl}/sitemap.xml`,
    '',
  ].join('\n');
}

export const Route = createFileRoute('/robots.txt')({
  server: {
    handlers: {
      GET: () =>
        new Response(buildRobotsTxt(), {
          headers: { 'content-type': 'text/plain; charset=utf-8' },
        }),
    },
  },
});
