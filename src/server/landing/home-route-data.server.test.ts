import assert from 'node:assert/strict';
import test from 'node:test';
import { site } from '@/site';

import { buildCanonicalUrl } from '@/shared/seo/canonical';

import { resolveHomeRouteData } from './home-route-resolver';

test('resolveHomeRouteData returns default home data', async () => {
  const data = await resolveHomeRouteData({ locale: 'en' });

  assert.ok(data);
  assert.equal(data.locale, 'en');
  assert.equal(data.canonicalPath, '/');
  assert.match(data.page.hero?.title ?? '', /Launch the first version/);
  assert.equal(data.shell.brand.title, site.brand.appName);
  assert.ok(data.shell.header.navItems.length > 0);
  assert.deepEqual(
    data.head.links?.find((link) => link.rel === 'canonical'),
    {
      rel: 'canonical',
      href: buildCanonicalUrl('/'),
    }
  );
});

test('resolveHomeRouteData returns approved localized home data', async () => {
  const data = await resolveHomeRouteData({ locale: 'zh' });

  assert.ok(data);
  assert.equal(data.locale, 'zh');
  assert.deepEqual(
    data.head.links?.find((link) => link.rel === 'canonical'),
    {
      rel: 'canonical',
      href: buildCanonicalUrl('/', 'zh'),
    }
  );
});

test('resolveHomeRouteData rejects invalid locales', async () => {
  const data = await resolveHomeRouteData({ locale: 'fr' });

  assert.equal(data, null);
});

test('resolveHomeRouteData rejects locales without home messages instead of falling back to English', async () => {
  const data = await resolveHomeRouteData({ locale: 'ja' });

  assert.equal(data, null);
});
