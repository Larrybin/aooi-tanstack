import assert from 'node:assert/strict';
import test from 'node:test';

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
  assert.match(data.page.content, /Roller Rabbit Local/);
  assert.deepEqual(
    data.head.links?.find((link) => link.rel === 'canonical'),
    {
      rel: 'canonical',
      href: 'http://localhost:3000/terms-of-service',
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

test('resolveSlugRouteData rejects unpublished localized pages', async () => {
  const data = await resolveSlugRouteData({
    locale: 'zh',
    slug: 'terms-of-service',
  });

  assert.equal(data, null);
});
