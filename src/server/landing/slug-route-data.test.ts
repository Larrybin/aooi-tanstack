import assert from 'node:assert/strict';
import test from 'node:test';
import { site } from '@/site';

import { buildCanonicalUrl } from '@/shared/seo/canonical';

import { resolveSlugRouteData } from './slug-route-resolver';

test('resolveSlugRouteData returns generated public page data', async () => {
  const data = await resolveSlugRouteData({
    locale: 'en',
    slug: 'terms-of-service',
  });

  assert.ok(data);
  assert.equal(data.locale, 'en');
  assert.equal(data.slug, 'terms-of-service');
  assert.equal(data.canonicalPath, '/terms-of-service');
  assert.equal(data.page.slug, 'terms-of-service');
  assert.equal(data.page.title, 'Terms of Service');
  assert.equal(data.page.createdAt, 'Oct 24, 2025');
  assert.match(data.page.content, new RegExp(site.brand.appName));
  assert.deepEqual(
    data.head.links?.find((link) => link.rel === 'canonical'),
    {
      rel: 'canonical',
      href: buildCanonicalUrl('/terms-of-service'),
    }
  );
});

test('resolveSlugRouteData rejects invalid locales', async () => {
  const data = await resolveSlugRouteData({
    locale: 'fr',
    slug: 'terms-of-service',
  });

  assert.equal(data, null);
});

test('resolveSlugRouteData rejects malformed input without throwing', async () => {
  const data = await resolveSlugRouteData({
    locale: 'en',
    slug: 123,
  } as never);

  assert.equal(data, null);
});

test('resolveSlugRouteData rejects unpublished localized pages', async () => {
  const data = await resolveSlugRouteData({
    locale: 'zh',
    slug: 'terms-of-service',
  });

  assert.equal(data, null);
});
