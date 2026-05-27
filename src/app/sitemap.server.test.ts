import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildCanonicalUrl,
  getPublishedLocalesForPath,
} from '@/infra/url/canonical';
import { site } from '@/site';

import sitemap from './sitemap';

test('sitemap uses approved published locales per route', async () => {
  const routes = [
    '/',
    '/pricing',
    ...(site.capabilities.blog ? ['/blog'] : []),
    ...(site.capabilities.docs ? ['/docs'] : []),
  ];
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
