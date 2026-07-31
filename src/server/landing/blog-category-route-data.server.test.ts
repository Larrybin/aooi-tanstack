import assert from 'node:assert/strict';
import test from 'node:test';
import { site } from '@/site';

import { resolveBlogCategoryRouteData } from './blog-category-route-resolver';

test('resolveBlogCategoryRouteData returns null when blog capability is disabled', async () => {
  const originalModules = site.capabilities.enabledModules;
  const modules = originalModules.filter((moduleId) => moduleId !== 'blog');
  Object.defineProperty(site.capabilities, 'enabledModules', {
    configurable: true,
    value: modules,
  });
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
    Object.defineProperty(site.capabilities, 'enabledModules', {
      configurable: true,
      value: originalModules,
    });
  }
});
