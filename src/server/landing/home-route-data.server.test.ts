import assert from 'node:assert/strict';
import test from 'node:test';
import { site, siteHomeContent } from '@/site';

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

  if (isProductSite()) {
    assert.equal(data.variant, 'product');
    assert.equal(data.productHome.kind, site.key);
    assert.equal(
      data.head.meta?.find((meta) => 'title' in meta)?.title,
      data.productHome.copy.metadata.title
    );
  } else {
    assert.equal(data.variant, 'generic');
    assert.match(data.page.hero?.title ?? '', /Launch the first version/);
  }
});

test('resolveHomeRouteData returns approved localized home data', async () => {
  const data = await resolveHomeRouteData({ locale: 'zh' });

  if (
    site.key === 'text-to-speech-generator' ||
    site.key === 'mp4-compressor'
  ) {
    assert.equal(data, null);
    return;
  }

  assert.ok(data);
  assert.equal(data.locale, 'zh');
  assert.equal(data.variant, isProductSite() ? 'product' : 'generic');
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

  if (site.key === 'ai-remover' || site.key === 'background-remover') {
    assert.ok(data);
    assert.equal(data.variant, 'product');
    assert.equal(data.productHome.kind, site.key);
    assert.deepEqual(data.productHome.copy, getHomeContent('ja'));
    return;
  }

  assert.equal(data, null);
});

function isProductSite() {
  return [
    'ai-remover',
    'background-remover',
    'text-to-speech-generator',
    'mp4-compressor',
  ].includes(site.key);
}

function getHomeContent(locale: string) {
  return (siteHomeContent as Readonly<Record<string, unknown>>)[locale];
}
