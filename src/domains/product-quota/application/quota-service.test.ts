import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import {
  commitProductQuota,
  refundProductQuota,
  reserveProductQuota,
  type ProductQuotaOperationKey,
} from './quota-service';

const now = new Date('2026-05-06T12:00:00Z');
const windowStart = new Date('2026-05-06T00:00:00Z');
const expiresAt = new Date('2026-05-07T12:00:00Z');

test('reserveProductQuota creates an anonymous owner-scoped reservation draft', async () => {
  let captured:
    | Parameters<
        NonNullable<
          Parameters<typeof reserveProductQuota>[0]['deps']
        >['reserve']
      >[0]
    | undefined;

  const result = await reserveProductQuota({
    actor: { kind: 'anonymous', anonymousSessionId: 'anon_1' },
    siteKey: 'ai-remover',
    productKey: 'ai-remover',
    productId: 'free',
    operationKey: 'upload.create',
    units: 1,
    limit: 2,
    windowStart,
    idempotencyKey: 'upload:anonymous:anon_1:file_1',
    expiresAt,
    now,
    createId: () => 'reservation_1',
    deps: {
      reserve: async (input) => {
        captured = input;
        return {
          reservation: { id: input.reservation.id },
          reused: false,
        };
      },
    },
  });

  assert.deepEqual(result, {
    reservation: { id: 'reservation_1' },
    reused: false,
  });
  assert.deepEqual(captured, {
    reservation: {
      id: 'reservation_1',
      userId: null,
      anonymousSessionId: 'anon_1',
      siteKey: 'ai-remover',
      productKey: 'ai-remover',
      productId: 'free',
      operationKey: 'upload.create',
      units: 1,
      status: 'reserved',
      idempotencyKey: 'upload:anonymous:anon_1:file_1',
      jobId: null,
      reason: null,
      entitlementGrantIdsJson: null,
      expiresAt,
    },
    quota: {
      userId: null,
      anonymousSessionId: 'anon_1',
      siteKey: 'ai-remover',
      productKey: 'ai-remover',
      operationKey: 'upload.create',
      windowStart,
      limit: 2,
      requestedUnits: 1,
      now,
    },
  });
});

test('reserveProductQuota scopes user actors by user id only', async () => {
  let owner:
    | { userId: string | null; anonymousSessionId: string | null }
    | undefined;

  await reserveProductQuota({
    actor: {
      kind: 'user',
      userId: 'user_1',
      anonymousSessionId: 'anon_1',
    },
    siteKey: 'ai-remover',
    productKey: 'ai-remover',
    productId: 'free',
    operationKey: 'image.remove',
    units: 1,
    limit: 2,
    windowStart,
    idempotencyKey: 'processing:user:user_1:idem_1',
    expiresAt,
    createId: () => 'reservation_1',
    deps: {
      reserve: async ({ reservation }) => {
        owner = {
          userId: reservation.userId,
          anonymousSessionId: reservation.anonymousSessionId,
        };
        return { reservation, reused: false };
      },
    },
  });

  assert.deepEqual(owner, {
    userId: 'user_1',
    anonymousSessionId: null,
  });
});

test('reserveProductQuota rejects requests above limit before storage writes', async () => {
  let reserveCalled = false;

  await assert.rejects(
    () =>
      reserveProductQuota({
        actor: { kind: 'anonymous', anonymousSessionId: 'anon_1' },
        siteKey: 'ai-remover',
        productKey: 'ai-remover',
        productId: 'free',
        operationKey: 'upload.create',
        units: 2,
        limit: 1,
        windowStart,
        idempotencyKey: 'idem_1',
        expiresAt,
        deps: {
          reserve: async () => {
            reserveCalled = true;
            return { reservation: { id: 'reservation_1' }, reused: false };
          },
        },
      }),
    /product quota exceeded/
  );
  assert.equal(reserveCalled, false);
});

test('reserveProductQuota keeps operationKey distinct for product callers', async () => {
  const operationKeys: ProductQuotaOperationKey[] = [];

  for (const operationKey of [
    'upload.create',
    'image.remove',
    'image.hd_download',
  ] as const) {
    await reserveProductQuota({
      actor: { kind: 'anonymous', anonymousSessionId: 'anon_1' },
      siteKey: 'ai-remover',
      productKey: 'ai-remover',
      productId: 'free',
      operationKey,
      units: 1,
      limit: 3,
      windowStart,
      idempotencyKey: `idem:${operationKey}`,
      expiresAt,
      deps: {
        reserve: async ({ quota }) => {
          operationKeys.push(quota.operationKey);
          return {
            reservation: { id: `reservation:${operationKey}` },
            reused: false,
          };
        },
      },
    });
  }

  assert.deepEqual(operationKeys, [
    'upload.create',
    'image.remove',
    'image.hd_download',
  ]);
});

test('commitProductQuota and refundProductQuota delegate state changes', async () => {
  const committed = await commitProductQuota({
    reservationId: 'reservation_1',
    now,
    deps: {
      commit: async (input) => ({
        id: input.reservationId,
        status: 'committed',
        committedAt: input.now,
      }),
    },
  });
  const refunded = await refundProductQuota({
    reservationId: 'reservation_2',
    reason: 'provider failed',
    now,
    deps: {
      refund: async (input) => ({
        id: input.reservationId,
        status: 'refunded',
        reason: input.reason,
        refundedAt: input.now,
      }),
    },
  });

  assert.deepEqual(committed, {
    id: 'reservation_1',
    status: 'committed',
    committedAt: now,
  });
  assert.deepEqual(refunded, {
    id: 'reservation_2',
    status: 'refunded',
    reason: 'provider failed',
    refundedAt: now,
  });
});

test('product-quota source files do not import remover', () => {
  const root = path.join(process.cwd(), 'src/domains/product-quota');
  const files = ['domain', 'application'].flatMap((segment) =>
    readdirSync(path.join(root, segment))
      .filter((file) => file.endsWith('.ts') && !file.endsWith('.test.ts'))
      .map((file) => path.join(root, segment, file))
  );

  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    assert.doesNotMatch(source, /domains\/remover|@\/domains\/remover/);
  }
});
