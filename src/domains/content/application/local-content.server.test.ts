import assert from 'node:assert/strict';
import test from 'node:test';

import { getBlogPost, getDocsPage } from './public-content.query';

test('getDocsPage returns serializable markdown content without React body', async () => {
  const page = await getDocsPage({
    slug: 'privacy-policy',
    locale: 'en',
  });

  assert.ok(page);
  assert.equal(page.slug, 'privacy-policy');
  assert.equal(typeof page.content, 'string');
  assert.ok(page.content.length > 0);
  assert.equal(page.body, undefined);
});

test('getBlogPost returns local markdown content without React body', async () => {
  const post = await getBlogPost({
    slug: 'what-is-xxx',
    locale: 'en',
  });

  assert.ok(post);
  assert.equal(post.slug, 'what-is-xxx');
  assert.equal(typeof post.content, 'string');
  assert.ok(post.content.length > 0);
  assert.equal(post.body, undefined);
});
