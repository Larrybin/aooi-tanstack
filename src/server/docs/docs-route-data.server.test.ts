import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { resolveDocsRouteData } from './docs-route-resolver';

test('resolveDocsRouteData reads docs from generated public content manifest', () => {
  const data = resolveDocsRouteData({ locale: 'zh', slug: ['quick-start'] });

  assert.equal(data?.locale, 'zh');
  assert.equal(data?.slug.join('/'), 'quick-start');
  assert.match(data?.content ?? '', /本地开发/);
});

test('docs route data stays Cloudflare-compatible and does not read the file system at runtime', async () => {
  const source = await readFile('src/server/docs/docs-route-data.ts', 'utf8');

  assert.doesNotMatch(source, /node:fs|fs\/promises|process\.cwd\(/);
});

test('resolveDocsRouteData returns null for unknown docs slug', () => {
  assert.equal(
    resolveDocsRouteData({ locale: 'en', slug: ['missing-doc'] }),
    null
  );
});

test('resolveDocsRouteData replaces brand placeholders in docs content', () => {
  const index = resolveDocsRouteData({ locale: 'en', slug: [] });
  const quickStart = resolveDocsRouteData({
    locale: 'en',
    slug: ['quick-start'],
  });

  assert.ok(index);
  assert.ok(quickStart);

  for (const data of [index, quickStart]) {
    assert.doesNotMatch(data.title, /YourAppName|your-domain\.com/);
    assert.doesNotMatch(data.description, /YourAppName|your-domain\.com/);
    assert.doesNotMatch(data.content, /YourAppName|your-domain\.com/);
  }
});

test('resolveDocsRouteData returns null for unsupported locale', () => {
  assert.equal(
    resolveDocsRouteData({ locale: 'foo', slug: ['quick-start'] }),
    null
  );
});
