import assert from 'node:assert/strict';
import test from 'node:test';

import { searchDocsIndex, type DocsSearchDocument } from './search-index';

const DOCS: DocsSearchDocument[] = [
  {
    locale: 'en',
    slug: 'quick-start',
    path: '/docs/quick-start',
    title: 'Quick Start',
    description: 'Run the app locally.',
    content: 'Install dependencies and start the development server.',
    toc: [{ title: 'Local Development', url: '#local-development', depth: 2 }],
  },
  {
    locale: 'zh',
    slug: 'quick-start',
    path: '/zh/docs/quick-start',
    title: '快速开始',
    description: '本地运行应用。',
    content: '安装依赖并启动开发服务器。',
    toc: [{ title: '本地开发', url: '#local-development', depth: 2 }],
  },
];

test('searchDocsIndex returns empty results for empty query', () => {
  assert.deepEqual(searchDocsIndex({ documents: DOCS, query: '   ' }), []);
});

test('searchDocsIndex matches title and heading case-insensitively', () => {
  const results = searchDocsIndex({ documents: DOCS, query: 'LOCAL' });

  assert.equal(results[0]?.url, '/docs/quick-start#local-development');
  assert.equal(results[0]?.type, 'heading');
  assert.equal(results.some((result) => result.url === '/docs/quick-start'), true);
});

test('searchDocsIndex filters by locale', () => {
  const results = searchDocsIndex({
    documents: DOCS,
    query: '开发',
    locale: 'zh',
  });

  assert.equal(results.length > 0, true);
  assert.equal(results.every((result) => result.url.startsWith('/zh/')), true);
});

test('searchDocsIndex returns deterministic limited results', () => {
  const results = searchDocsIndex({ documents: DOCS, query: 'start', limit: 1 });

  assert.equal(results.length, 1);
  assert.equal(typeof results[0]?.id, 'string');
  assert.equal(typeof results[0]?.content, 'string');
});
