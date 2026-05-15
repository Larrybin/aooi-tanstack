import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assertQuotaAvailable,
  commitQuotaReservation,
  getQuotaWindowStart,
  refundQuotaReservation,
} from './quota';

test('getQuotaWindowStart resolves day and month windows', () => {
  const now = new Date('2026-05-06T12:34:56Z');

  assert.equal(
    getQuotaWindowStart(now, 'day').toISOString(),
    '2026-05-06T00:00:00.000Z'
  );
  assert.equal(
    getQuotaWindowStart(now, 'month').toISOString(),
    '2026-05-01T00:00:00.000Z'
  );
});

test('assertQuotaAvailable rejects requests that exceed the configured limit', () => {
  assert.doesNotThrow(() =>
    assertQuotaAvailable({ usedUnits: 1, requestedUnits: 1, limit: 2 })
  );
  assert.throws(
    () =>
      assertQuotaAvailable({ usedUnits: 2, requestedUnits: 1, limit: 2 }),
    /remover quota exceeded/
  );
});

test('quota reservation commit and refund are idempotent inside each terminal state', () => {
  assert.equal(commitQuotaReservation({ status: 'reserved' }), 'committed');
  assert.equal(commitQuotaReservation({ status: 'committed' }), 'committed');
  assert.equal(refundQuotaReservation({ status: 'reserved' }), 'refunded');
  assert.equal(refundQuotaReservation({ status: 'refunded' }), 'refunded');
  assert.throws(
    () => commitQuotaReservation({ status: 'refunded' }),
    /already refunded/
  );
  assert.throws(
    () => refundQuotaReservation({ status: 'committed' }),
    /already committed/
  );
});
