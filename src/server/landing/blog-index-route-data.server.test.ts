import assert from 'node:assert/strict';
import test from 'node:test';
import { site } from '@/site';

import { resolveBlogIndexRouteData } from './blog-index-route-resolver';

test('resolveBlogIndexRouteData builds blog index route data', async () => {
  const originalBlog = site.capabilities.blog;
  site.capabilities.blog = true;
  const blogQueryInputs: Array<{
    locale: string;
    postPrefix?: string;
    categoryPrefix?: string;
  }> = [];
  const getBlogPostsAndCategories = async (input: {
    locale: string;
    postPrefix?: string;
    categoryPrefix?: string;
  }) => {
    blogQueryInputs.push(input);

    return {
      posts: [
        {
          id: 'post-1',
          slug: 'hello-world',
          title: 'Hello World',
          description: 'A test post',
          image: '',
          url: `${input.postPrefix ?? '/blog/'}hello-world`,
          created_at: 'Jan 1, 2026',
          author_name: 'Author',
          author_image: '',
        },
      ],
      postsCount: 1,
      categories: [
        {
          id: 'category-1',
          slug: 'updates',
          title: 'Updates',
          description: 'Product updates',
          url: `${input.categoryPrefix ?? '/blog/category/'}updates`,
          isActive: false,
        },
      ],
      categoriesCount: 1,
    };
  };
  const deps = { getBlogPostsAndCategories };

  try {
    const defaultData = await resolveBlogIndexRouteData({ locale: 'en' }, deps);

    assert.ok(defaultData);
    assert.equal(defaultData.locale, 'en');
    assert.equal(defaultData.canonicalPath, '/blog');
    assert.deepEqual(blogQueryInputs[0], {
      locale: 'en',
      postPrefix: '/blog/',
      categoryPrefix: '/blog/category/',
    });
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

    const localizedData = await resolveBlogIndexRouteData(
      { locale: 'zh' },
      deps
    );

    assert.ok(localizedData);
    assert.equal(localizedData.locale, 'zh');
    assert.deepEqual(blogQueryInputs[1], {
      locale: 'zh',
      postPrefix: '/zh/blog/',
      categoryPrefix: '/zh/blog/category/',
    });
    assert.equal(localizedData.blog.currentCategory.url, '/zh/blog');
    assert.equal(localizedData.blog.categories[0]?.url, '/zh/blog');

    for (const category of localizedData.blog.categories.slice(1)) {
      assert.match(category.url, /^\/zh\/blog\/category\//);
    }

    for (const post of localizedData.blog.posts) {
      assert.match(post.url, /^\/zh\/blog\//);
    }

    const invalidLocaleData = await resolveBlogIndexRouteData(
      { locale: 'fr' },
      deps
    );
    assert.equal(invalidLocaleData, null);

    site.capabilities.blog = false;

    const data = await resolveBlogIndexRouteData({ locale: 'en' }, deps);
    assert.equal(data, null);
  } finally {
    site.capabilities.blog = originalBlog;
  }
});
