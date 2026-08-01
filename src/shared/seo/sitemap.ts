import { siteI18nPages } from '@/site';

import { buildCanonicalUrl, getPublishedLocalesForPath } from './canonical';

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function buildSitemapXml() {
  const urls = siteI18nPages.pages
    .filter((page) => page.indexable)
    .flatMap((page) =>
      getPublishedLocalesForPath(page.path).map((locale) =>
        [
          '  <url>',
          `    <loc>${escapeXml(buildCanonicalUrl(page.path, locale))}</loc>`,
          '  </url>',
        ].join('\n')
      )
    );

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls,
    '</urlset>',
    '',
  ].join('\n');
}
