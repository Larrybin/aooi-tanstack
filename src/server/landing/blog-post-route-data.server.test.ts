import assert from 'node:assert/strict';
import test from 'node:test';
import { site } from '@/site';

import { resolveBlogPostRouteData } from './blog-post-route-resolver';

test('resolveBlogPostRouteData returns null when blog capability is disabled', async () => {
  const originalModules = site.capabilities.enabledModules;
  const modules = originalModules.filter((moduleId) => moduleId !== 'blog');
  Object.defineProperty(site.capabilities, 'enabledModules', {
    configurable: true,
    value: modules,
  });
  let loadedPost = false;

  try {
    const data = await resolveBlogPostRouteData(
      { locale: 'en', slug: 'hello-world' },
      {
        getBlogPost: async () => {
          loadedPost = true;
          return null;
        },
      }
    );

    assert.equal(data, null);
    assert.equal(loadedPost, false);
  } finally {
    Object.defineProperty(site.capabilities, 'enabledModules', {
      configurable: true,
      value: originalModules,
    });
  }
});
