import assert from 'node:assert/strict';
import test from 'node:test';
import { site, siteHomeContent, siteI18nManifest } from '@/site';

import { buildCanonicalUrl } from '@/shared/seo/canonical';

import { resolveHomeRouteData } from './home-route-resolver';

test('resolveHomeRouteData returns default home data', async () => {
  const data = await resolveHomeRouteData({ locale: 'en' });

  assert.ok(data);
  assert.equal(data.locale, 'en');
  assert.equal(data.canonicalPath, '/');
  assert.equal(data.shell.brand.title, site.brand.appName);
  assert.ok(data.shell.header.navItems.length > 0);
  assert.deepEqual(
    data.head.links?.find((link) => link.rel === 'canonical'),
    {
      rel: 'canonical',
      href: buildCanonicalUrl('/'),
    }
  );

  if (data.variant === 'product') {
    assert.equal(
      data.head.meta?.find((meta) => 'title' in meta)?.title,
      data.productHome.copy.metadata.title
    );
    if (site.key === '401k-calculator') {
      assert.equal(data.head.scripts?.length, 3);
      assert.equal(
        data.head.scripts?.every(
          (script) => script.type === 'application/ld+json'
        ),
        true
      );
    } else {
      assert.equal(data.head.scripts, undefined);
    }
  } else {
    assert.equal(data.variant, 'generic');
    assert.match(data.page.hero?.title ?? '', /Launch the first version/);
  }
});

test('resolveHomeRouteData returns approved localized home data', async () => {
  const data = await resolveHomeRouteData({ locale: 'zh' });

  if (!hasApprovedHome('zh')) {
    assert.equal(data, null);
    return;
  }

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

  if (data) {
    assert.equal(data.variant, 'product');
    assert.deepEqual(data.productHome.copy, getHomeContent('ja'));
    return;
  }

  assert.equal(data, null);
});

function getHomeContent(locale: string) {
  return (siteHomeContent as Readonly<Record<string, unknown>>)[locale];
}

function hasApprovedHome(locale: string) {
  const locales = siteI18nManifest.locales as Readonly<
    Record<string, Readonly<Record<string, { path: string; status: string }>>>
  >;
  return Object.values(locales[locale] ?? {}).some(
    (entry) => entry.path === '/' && entry.status === 'approved'
  );
}
