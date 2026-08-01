import assert from 'node:assert/strict';
import test from 'node:test';
import { siteI18nPages } from '@/site';

import { buildCanonicalUrl } from './canonical';
import { buildSitemapXml } from './sitemap';

test('buildSitemapXml lists canonical indexable pages without fake lastmod', () => {
  const xml = buildSitemapXml();
  const indexablePaths = siteI18nPages.pages
    .filter((page) => page.indexable)
    .map((page) => page.path);

  for (const path of indexablePaths) {
    assert.match(xml, new RegExp(escapeRegExp(buildCanonicalUrl(path))));
  }

  assert.doesNotMatch(xml, /<lastmod>/);
});

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
