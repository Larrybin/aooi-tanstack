import assert from 'node:assert/strict';
import test from 'node:test';
import type { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';

import {
  assertRemoverQuotaAvailable,
  toRemoverQuotaCheck,
  toRemoverQuotaReservationInsert,
} from './quota-reservation';

test('assertRemoverQuotaAvailable ignores expired reserved quota rows', async () => {
  let capturedWhere: SQL | undefined;
  const now = new Date('2026-05-07T00:00:00Z');

  const tx = {
    select() {
      return {
        from() {
          return {
            where(condition: SQL) {
              capturedWhere = condition;
              return Promise.resolve([{ total: '0' }]);
            },
          };
        },
      };
    },
  };

  await assertRemoverQuotaAvailable(tx as never, {
    userId: 'user_1',
    anonymousSessionId: null,
    siteKey: 'ai-remover',
    productKey: 'ai-remover',
    operationKey: 'image.hd_download',
    quotaType: 'high_res_download',
    windowStart: new Date(0),
    limit: 3,
    requestedUnits: 1,
    now,
  });

  assert.ok(capturedWhere);
  const query = new PgDialect().sqlToQuery(capturedWhere);

  assert.match(query.sql, /"product_quota_reservation"."status" = \$\d+/);
  assert.match(query.sql, /"product_quota_reservation"."expires_at" > \$\d+/);
});

test('AI Remover product quota operation keys map to existing storage quota types', () => {
  const baseQuota = {
    userId: 'user_1',
    anonymousSessionId: null,
    siteKey: 'ai-remover',
    productKey: 'ai-remover',
    windowStart: new Date('2026-05-01T00:00:00Z'),
    limit: 10,
    requestedUnits: 1,
  };

  assert.equal(
    toRemoverQuotaCheck({
      ...baseQuota,
      operationKey: 'upload.create',
    }).quotaType,
    'upload'
  );
  assert.equal(
    toRemoverQuotaCheck({
      ...baseQuota,
      operationKey: 'image.remove',
    }).quotaType,
    'processing'
  );
  assert.equal(
    toRemoverQuotaCheck({
      ...baseQuota,
      operationKey: 'image.hd_download',
    }).quotaType,
    'high_res_download'
  );
});

test('AI Remover reservation insert targets the generic product quota table shape', () => {
  const reservation = toRemoverQuotaReservationInsert({
    id: 'reservation_1',
    userId: 'user_1',
    anonymousSessionId: null,
    siteKey: 'ai-remover',
    productKey: 'ai-remover',
    productId: 'free',
    operationKey: 'image.remove',
    units: 1,
    status: 'reserved',
    idempotencyKey: 'processing:user:user_1:idem_1',
    jobId: 'job_1',
    reason: null,
    entitlementGrantIdsJson: '["grant_1"]',
    expiresAt: new Date('2026-05-07T00:00:00Z'),
  });

  assert.deepEqual(reservation, {
    id: 'reservation_1',
    userId: 'user_1',
    anonymousSessionId: null,
    siteKey: 'ai-remover',
    productKey: 'ai-remover',
    productId: 'free',
    operationKey: 'image.remove',
    units: 1,
    status: 'reserved',
    idempotencyKey: 'processing:user:user_1:idem_1',
    jobId: 'job_1',
    reason: null,
    entitlementGrantIdsJson: '["grant_1"]',
    expiresAt: new Date('2026-05-07T00:00:00Z'),
  });
});
