import assert from 'node:assert/strict';
import test from 'node:test';

import { readPublicContentDocumentTitle } from './public-content-manifest.mjs';

test('readPublicContentDocumentTitle prefers frontmatter title', () => {
  assert.equal(
    readPublicContentDocumentTitle(
      { title: 'Frontmatter title' },
      [{ title: 'H1 title', url: '#h1-title', depth: 1 }]
    ),
    'Frontmatter title'
  );
});

test('readPublicContentDocumentTitle falls back to first H1 toc item', () => {
  assert.equal(
    readPublicContentDocumentTitle(
      {},
      [
        { title: 'Intro', url: '#intro', depth: 2 },
        { title: 'Derived H1', url: '#derived-h1', depth: 1 },
      ]
    ),
    'Derived H1'
  );
});
