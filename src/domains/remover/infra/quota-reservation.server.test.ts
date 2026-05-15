import assert from 'node:assert/strict';
import test from 'node:test';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';

import { assertRemoverQuotaAvailable } from './quota-reservation';

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
    quotaType: 'high_res_download',
    windowStart: new Date(0),
    limit: 3,
    requestedUnits: 1,
    now,
  });

  assert.ok(capturedWhere);
  const query = new PgDialect().sqlToQuery(capturedWhere);

  assert.match(query.sql, /"remover_quota_reservation"."status" = \$\d+/);
  assert.match(query.sql, /"remover_quota_reservation"."expires_at" > \$\d+/);
});
