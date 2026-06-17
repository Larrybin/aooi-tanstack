import {
  buildCanonicalUrl,
  getPublishedLocalesForPath,
} from '@/infra/url/canonical';
import { siteI18nPages } from '@/site';
import { createFileRoute } from '@tanstack/react-router';

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function buildSitemapXml() {
  const routes = siteI18nPages.pages
    .filter((page) => page.indexable)
    .map((page) => page.path);
  const lastModified = new Date().toISOString();
  const urls = routes.flatMap((route) =>
    getPublishedLocalesForPath(route).map((locale) =>
      [
        '  <url>',
        `    <loc>${escapeXml(buildCanonicalUrl(route, locale))}</loc>`,
        `    <lastmod>${lastModified}</lastmod>`,
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

export const Route = createFileRoute('/sitemap.xml')({
  server: {
    handlers: {
      GET: () =>
        new Response(buildSitemapXml(), {
          headers: { 'content-type': 'application/xml; charset=utf-8' },
        }),
    },
  },
});
