import assert from 'node:assert/strict';
import test from 'node:test';
import { siteI18nPages } from '@/site';

import robots from './robots';

test('robots does not block indexable site pages', () => {
  const result = robots();
  const rules = Array.isArray(result.rules) ? result.rules[0] : result.rules;
  const disallow = Array.isArray(rules?.disallow)
    ? rules.disallow
    : [rules?.disallow].filter(Boolean);

  for (const page of siteI18nPages.pages) {
    if (!page.indexable) {
      continue;
    }

    assert.equal(disallow.includes(page.path), false, page.path);
  }
});

test('robots blocks protected app areas', () => {
  const result = robots();
  const rules = Array.isArray(result.rules) ? result.rules[0] : result.rules;
  const disallow = Array.isArray(rules?.disallow)
    ? rules.disallow
    : [rules?.disallow].filter(Boolean);

  assert.equal(disallow.includes('/admin'), true);
  assert.equal(disallow.includes('/settings'), true);
});
