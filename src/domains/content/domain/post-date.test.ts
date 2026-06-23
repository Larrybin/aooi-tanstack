import assert from 'node:assert/strict';
import test from 'node:test';

import { formatPostDate } from './post-date';

test('formatPostDate keeps existing public date formats', () => {
  assert.equal(formatPostDate('2026-04-05T10:30:00.000Z'), 'Apr 5, 2026');
  assert.equal(formatPostDate('2026-04-05T10:30:00.000Z', 'zh'), '2026/04/05');
  assert.equal(formatPostDate('not-a-date'), 'Invalid date');
});
