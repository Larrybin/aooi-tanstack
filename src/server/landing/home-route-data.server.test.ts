import assert from 'node:assert/strict';
import test from 'node:test';
import { site, siteHomeContent, siteI18nManifest } from '@/site';
import { resolveSiteHomeRouteData } from '@/site-home-server';

import { buildCanonicalUrl } from '@/shared/seo/canonical';

test('resolveSiteHomeRouteData returns default home data', async () => {
  const data = await resolveSiteHomeRouteData('en');

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

  if (hasProductHome(data)) {
    assert.equal(
      data.head.meta?.find((meta) => 'title' in meta)?.title,
      data.productHome.copy.metadata.title
    );
    if (site.key === '401k-calculator') {
      assert.equal(data.head.scripts?.length, 2);
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
    assert.ok(hasGenericPage(data));
    assert.match(data.page.hero?.title ?? '', /Launch the first version/);
  }
});

test('resolveSiteHomeRouteData returns approved localized home data', async () => {
  const data = await resolveSiteHomeRouteData('zh');

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

test('resolveSiteHomeRouteData rejects invalid locales', async () => {
  const data = await resolveSiteHomeRouteData('fr');

  assert.equal(data, null);
});

test('resolveSiteHomeRouteData rejects locales without home messages instead of falling back to English', async () => {
  const data = await resolveSiteHomeRouteData('ja');

  if (data && hasProductHome(data)) {
    assert.deepEqual(data.productHome.copy, getHomeContent('ja'));
    return;
  }

  assert.equal(data, null);
});

function getHomeContent(locale: string) {
  return (siteHomeContent as Readonly<Record<string, unknown>>)[locale];
}

function hasProductHome(data: object): data is typeof data & {
  productHome: { copy: { metadata: { title: string } } };
} {
  return 'productHome' in data;
}

function hasGenericPage(
  data: object
): data is typeof data & { page: { hero?: { title?: string } } } {
  return 'page' in data;
}

function hasApprovedHome(locale: string) {
  const locales = siteI18nManifest.locales as Readonly<
    Record<string, Readonly<Record<string, { path: string; status: string }>>>
  >;
  return Object.values(locales[locale] ?? {}).some(
    (entry) => entry.path === '/' && entry.status === 'approved'
  );
}
