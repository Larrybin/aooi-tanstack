import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildCanonicalUrl,
  getPublishedLocalesForPath,
} from '@/infra/url/canonical';
import { siteI18nPages } from '@/site';

import sitemap from './sitemap';

test('sitemap uses approved published locales for indexable site pages', async () => {
  const routes = siteI18nPages.pages
    .filter((page) => page.indexable)
    .map((page) => page.path);
  const entries = await sitemap();
  const urls = entries.map((entry) => entry.url);

  assert.equal(
    entries.length,
    routes.reduce(
      (count, route) => count + getPublishedLocalesForPath(route).length,
      0
    )
  );

  for (const route of routes) {
    for (const locale of getPublishedLocalesForPath(route)) {
      assert.ok(urls.includes(buildCanonicalUrl(route, locale)));
    }
  }
});
