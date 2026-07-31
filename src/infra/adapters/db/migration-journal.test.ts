import assert from 'node:assert/strict';
import test from 'node:test';

import { assertMigrationJournalCurrent } from './migration-journal';

const expected = {
  hash: 'expected-hash',
  createdAt: 200,
  tag: '0002_expected',
};

test('migration journal accepts the latest repository migration', () => {
  assert.doesNotThrow(() =>
    assertMigrationJournalCurrent({
      applied: { hash: expected.hash, createdAt: expected.createdAt },
      expected,
    })
  );
});

test('migration journal rejects a missing migration record', () => {
  assert.throws(
    () => assertMigrationJournalCurrent({ applied: null, expected }),
    /migration journal is empty/i
  );
});

test('migration journal rejects a database behind the repository', () => {
  assert.throws(
    () =>
      assertMigrationJournalCurrent({
        applied: { hash: 'older-hash', createdAt: 100 },
        expected,
      }),
    /behind.*0002_expected/i
  );
});

test('migration journal rejects a hash mismatch at the latest timestamp', () => {
  assert.throws(
    () =>
      assertMigrationJournalCurrent({
        applied: { hash: 'different-hash', createdAt: expected.createdAt },
        expected,
      }),
    /hash mismatch.*0002_expected/i
  );
});
