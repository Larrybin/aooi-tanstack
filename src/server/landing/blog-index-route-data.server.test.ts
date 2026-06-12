import assert from 'node:assert/strict';
import test from 'node:test';
import { site } from '@/site';

import { resolveBlogIndexRouteData } from './blog-index-route-resolver';

test('resolveBlogIndexRouteData builds blog index route data', async () => {
  const originalBlog = site.capabilities.blog;
  site.capabilities.blog = true;

  try {
    const defaultData = await resolveBlogIndexRouteData({ locale: 'en' });

    assert.ok(defaultData);
    assert.equal(defaultData.locale, 'en');
    assert.equal(defaultData.canonicalPath, '/blog');
    assert.equal(defaultData.blog.currentCategory.slug, 'all');
    assert.equal(defaultData.blog.currentCategory.url, '/blog');
    assert.equal(defaultData.blog.currentCategory.isActive, true);
    assert.equal(defaultData.blog.categories[0]?.slug, 'all');
    assert.equal(defaultData.blog.categories[0]?.isActive, true);
    const canonicalHref = defaultData.head.links?.find(
      (link) => link.rel === 'canonical'
    )?.href;
    assert.equal(canonicalHref ? new URL(canonicalHref).pathname : '', '/blog');

    for (const post of defaultData.blog.posts) {
      assert.match(post.url, /^\/blog\//);
    }

    const localizedData = await resolveBlogIndexRouteData({ locale: 'zh' });

    assert.ok(localizedData);
    assert.equal(localizedData.locale, 'zh');
    assert.equal(localizedData.blog.currentCategory.url, '/zh/blog');
    assert.equal(localizedData.blog.categories[0]?.url, '/zh/blog');

    for (const category of localizedData.blog.categories.slice(1)) {
      assert.match(category.url, /^\/zh\/blog\/category\//);
    }

    for (const post of localizedData.blog.posts) {
      assert.match(post.url, /^\/zh\/blog\//);
    }

    const invalidLocaleData = await resolveBlogIndexRouteData({ locale: 'fr' });
    assert.equal(invalidLocaleData, null);

    site.capabilities.blog = false;

    const data = await resolveBlogIndexRouteData({ locale: 'en' });
    assert.equal(data, null);
  } finally {
    site.capabilities.blog = originalBlog;
  }
});
