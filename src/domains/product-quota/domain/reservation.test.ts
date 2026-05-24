import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assertProductQuotaAvailable,
  commitProductQuotaReservation,
  getProductQuotaWindowStart,
  isProductQuotaReservationReusable,
  refundProductQuotaReservation,
} from './reservation';

test('getProductQuotaWindowStart resolves day and month windows', () => {
  const now = new Date('2026-05-06T12:34:56Z');

  assert.equal(
    getProductQuotaWindowStart(now, 'day').toISOString(),
    '2026-05-06T00:00:00.000Z'
  );
  assert.equal(
    getProductQuotaWindowStart(now, 'month').toISOString(),
    '2026-05-01T00:00:00.000Z'
  );
});

test('assertProductQuotaAvailable rejects invalid or over-limit requests', () => {
  assert.doesNotThrow(() =>
    assertProductQuotaAvailable({
      usedUnits: 1,
      requestedUnits: 1,
      limit: 2,
    })
  );
  assert.throws(
    () =>
      assertProductQuotaAvailable({
        usedUnits: 2,
        requestedUnits: 1,
        limit: 2,
      }),
    /product quota exceeded/
  );
  assert.throws(
    () =>
      assertProductQuotaAvailable({
        usedUnits: 0,
        requestedUnits: 0,
        limit: 2,
      }),
    /quota units must be positive/
  );
});

test('product quota reservations keep commit and refund terminal semantics', () => {
  assert.equal(
    commitProductQuotaReservation({ status: 'reserved' }),
    'committed'
  );
  assert.equal(
    commitProductQuotaReservation({ status: 'committed' }),
    'committed'
  );
  assert.equal(
    refundProductQuotaReservation({ status: 'reserved' }),
    'refunded'
  );
  assert.equal(
    refundProductQuotaReservation({ status: 'refunded' }),
    'refunded'
  );
  assert.throws(
    () => commitProductQuotaReservation({ status: 'refunded' }),
    /already refunded/
  );
  assert.throws(
    () => refundProductQuotaReservation({ status: 'committed' }),
    /already committed/
  );
});

test('isProductQuotaReservationReusable accepts committed and live reserved rows', () => {
  const now = new Date('2026-05-06T12:00:00Z');

  assert.equal(
    isProductQuotaReservationReusable({
      status: 'committed',
      expiresAt: new Date('2026-05-06T11:00:00Z'),
      now,
    }),
    true
  );
  assert.equal(
    isProductQuotaReservationReusable({
      status: 'reserved',
      expiresAt: new Date('2026-05-06T13:00:00Z'),
      now,
    }),
    true
  );
  assert.equal(
    isProductQuotaReservationReusable({
      status: 'reserved',
      expiresAt: new Date('2026-05-06T11:00:00Z'),
      now,
    }),
    false
  );
});
