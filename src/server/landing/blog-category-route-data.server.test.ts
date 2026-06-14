import assert from 'node:assert/strict';
import test from 'node:test';
import { site } from '@/site';

import { resolveBlogCategoryRouteData } from './blog-category-route-resolver';

test('resolveBlogCategoryRouteData returns null when blog capability is disabled', async () => {
  const originalBlog = site.capabilities.blog;
  site.capabilities.blog = false;
  let loadedCategory = false;

  try {
    const data = await resolveBlogCategoryRouteData(
      { locale: 'en', slug: 'updates' },
      {
        getBlogCategoryPostsAndCategories: async () => {
          loadedCategory = true;
          return null;
        },
      }
    );

    assert.equal(data, null);
    assert.equal(loadedCategory, false);
  } finally {
    site.capabilities.blog = originalBlog;
  }
});
