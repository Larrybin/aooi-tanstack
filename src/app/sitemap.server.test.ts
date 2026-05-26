import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCanonicalUrl } from '@/infra/url/canonical';
import { site } from '@/site';

import { locales } from '@/config/locale';

import sitemap from './sitemap';

test('sitemap uses the current site locale set', async () => {
  const routes = [
    '/',
    '/pricing',
    ...(site.capabilities.blog ? ['/blog'] : []),
    ...(site.capabilities.docs ? ['/docs'] : []),
  ];
  const entries = await sitemap();
  const urls = entries.map((entry) => entry.url);

  assert.equal(entries.length, locales.length * routes.length);

  for (const locale of locales) {
    for (const route of routes) {
      assert.ok(urls.includes(buildCanonicalUrl(route, locale)));
    }
  }
});
