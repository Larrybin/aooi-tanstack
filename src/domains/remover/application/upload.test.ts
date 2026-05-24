import assert from 'node:assert/strict';
import test from 'node:test';

import { TooManyRequestsError } from '@/shared/lib/api/errors';

import type {
  RemoverQuotaReservation,
  ReserveRemoverQuotaInput,
} from '../infra/quota-reservation';
import { uploadRemoverImage } from './upload';

const pngBytes = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

function reservationFromInput(
  input: ReserveRemoverQuotaInput
): RemoverQuotaReservation {
  const owner =
    input.actor.kind === 'user'
      ? { userId: input.actor.userId, anonymousSessionId: null }
      : { userId: null, anonymousSessionId: input.actor.anonymousSessionId };

  return {
    id: input.createId?.() ?? 'reservation_1',
    ...owner,
    productId: input.productId,
    quotaType: 'upload',
    units: input.units,
    status: 'reserved',
    idempotencyKey: input.idempotencyKey,
    jobId: input.jobId ?? null,
    reason: input.reason ?? null,
    entitlementGrantIdsJson: input.entitlementGrantIdsJson ?? null,
    createdAt: new Date('2026-05-06T00:00:00Z'),
    updatedAt: new Date('2026-05-06T00:00:00Z'),
    committedAt: null,
    refundedAt: null,
    expiresAt: input.expiresAt,
  };
}

test('uploadRemoverImage stores remover assets under an owner-scoped key', async () => {
  const result = await uploadRemoverImage({
    actor: {
      kind: 'anonymous',
      anonymousSessionId: 'anon_1',
    },
    file: new File([pngBytes], 'photo.png', { type: 'image/png' }),
    kind: 'original',
    width: 100,
    height: 80,
    deps: {
      detectImageMime: () => 'image/png',
      createId: () => 'asset_1',
      now: () => new Date('2026-05-06T00:00:00Z'),
      storageService: {
        uploadFile: async ({ key }) => ({
          success: true,
          key,
          url: `https://assets.example.com/${key}`,
        }),
        deleteFiles: async () => undefined,
      },
      reserveUploadQuota: async (input) => ({
        reservation: reservationFromInput(input),
        reused: false,
      }),
      commitReservation: async () => undefined,
      refundReservation: async () => undefined,
      createAsset: async (asset) => ({
        createdAt: new Date('2026-05-06T00:00:00Z'),
        updatedAt: new Date('2026-05-06T00:00:00Z'),
        deletedAt: null,
        ...asset,
      }),
    },
  });

  assert.equal(result.asset.id, 'asset_1');
  assert.equal(
    result.asset.storageKey,
    'remover/anonymous/anon_1/original/asset_1.png'
  );
  assert.equal(result.asset.width, 100);
  assert.equal(result.anonymousSessionId, 'anon_1');
});

test('uploadRemoverImage rejects unsupported image bytes', async () => {
  let reserved = false;
  await assert.rejects(
    () =>
      uploadRemoverImage({
        actor: {
          kind: 'anonymous',
          anonymousSessionId: 'anon_1',
        },
        file: new File([new Uint8Array([1, 2, 3])], 'photo.gif', {
          type: 'image/gif',
        }),
        kind: 'original',
        deps: {
          detectImageMime: () => null,
          storageService: {
            uploadFile: async () => {
              throw new Error('should not upload');
            },
            deleteFiles: async () => undefined,
          },
          reserveUploadQuota: async () => {
            reserved = true;
            throw new Error('should not reserve quota');
          },
          commitReservation: async () => undefined,
          refundReservation: async () => undefined,
          createAsset: async () => {
            throw new Error('should not create asset');
          },
        },
      }),
    /unsupported image type/
  );
  assert.equal(reserved, false);
});

test('uploadRemoverImage rejects detected but unsupported formats without reserving quota', async () => {
  let reserved = false;

  await assert.rejects(
    () =>
      uploadRemoverImage({
        actor: {
          kind: 'anonymous',
          anonymousSessionId: 'anon_1',
        },
        file: new File(
          [new Uint8Array([0x47, 0x49, 0x46, 0x38])],
          'photo.gif',
          {
            type: 'image/gif',
          }
        ),
        kind: 'original',
        deps: {
          detectImageMime: () => 'image/gif',
          storageService: {
            uploadFile: async () => {
              throw new Error('should not upload');
            },
            deleteFiles: async () => undefined,
          },
          reserveUploadQuota: async () => {
            reserved = true;
            throw new Error('should not reserve quota');
          },
          commitReservation: async () => undefined,
          refundReservation: async () => undefined,
          createAsset: async () => {
            throw new Error('should not create asset');
          },
        },
      }),
    /unsupported image type/
  );

  assert.equal(reserved, false);
});

test('uploadRemoverImage rejects uploads after the owner upload quota is reached', async () => {
  await assert.rejects(
    () =>
      uploadRemoverImage({
        actor: {
          kind: 'anonymous',
          anonymousSessionId: 'anon_1',
        },
        file: new File([pngBytes], 'photo.png', { type: 'image/png' }),
        kind: 'original',
        deps: {
          detectImageMime: () => 'image/png',
          reserveUploadQuota: async (input) => {
            throw new TooManyRequestsError('remover upload quota exceeded', {
              limit: input.limit,
              usedUnits: input.limit,
              requestedUnits: input.units,
            });
          },
          storageService: {
            uploadFile: async () => {
              throw new Error('should not upload');
            },
            deleteFiles: async () => undefined,
          },
          commitReservation: async () => undefined,
          refundReservation: async () => undefined,
          createAsset: async () => {
            throw new Error('should not create asset');
          },
          now: () => new Date('2026-05-06T00:00:00Z'),
        },
      }),
    /remover upload quota exceeded/
  );
});

test('uploadRemoverImage checks signed-in upload quota by user only', async () => {
  let quotaOwner:
    | { userId: string | null; anonymousSessionId: string | null }
    | undefined;
  let entitlementGrantIdsJson: string | null | undefined;
  let operationKey: string | undefined;

  await uploadRemoverImage({
    actor: {
      kind: 'user',
      userId: 'user_1',
      productId: 'free',
      anonymousSessionId: 'anon_2',
      entitlementGrantIds: ['grant_1'],
    },
    file: new File([pngBytes], 'photo.png', { type: 'image/png' }),
    kind: 'original',
    deps: {
      detectImageMime: () => 'image/png',
      createId: () => 'asset_1',
      now: () => new Date('2026-05-06T00:00:00Z'),
      reserveUploadQuota: async (input) => {
        quotaOwner =
          input.actor.kind === 'user'
            ? { userId: input.actor.userId, anonymousSessionId: null }
            : {
                userId: null,
                anonymousSessionId: input.actor.anonymousSessionId,
              };
        entitlementGrantIdsJson = input.entitlementGrantIdsJson;
        operationKey = input.operationKey;
        return {
          reservation: reservationFromInput(input),
          reused: false,
        };
      },
      commitReservation: async () => undefined,
      refundReservation: async () => undefined,
      storageService: {
        uploadFile: async ({ key }) => ({
          success: true,
          key,
          url: `https://assets.example.com/${key}`,
        }),
        deleteFiles: async () => undefined,
      },
      createAsset: async (asset) => ({
        createdAt: new Date('2026-05-06T00:00:00Z'),
        updatedAt: new Date('2026-05-06T00:00:00Z'),
        deletedAt: null,
        ...asset,
      }),
    },
  });

  assert.deepEqual(quotaOwner, {
    userId: 'user_1',
    anonymousSessionId: null,
  });
  assert.equal(entitlementGrantIdsJson, '["grant_1"]');
  assert.equal(operationKey, 'upload.create');
});

test('uploadRemoverImage commits upload quota only after storage and asset creation', async () => {
  const calls: string[] = [];

  await uploadRemoverImage({
    actor: {
      kind: 'anonymous',
      anonymousSessionId: 'anon_1',
    },
    file: new File([pngBytes], 'photo.png', { type: 'image/png' }),
    kind: 'original',
    deps: {
      detectImageMime: () => 'image/png',
      createId: () => 'asset_1',
      now: () => new Date('2026-05-06T00:00:00Z'),
      reserveUploadQuota: async (input) => {
        calls.push('reserve');
        return {
          reservation: reservationFromInput(input),
          reused: false,
        };
      },
      storageService: {
        uploadFile: async ({ key }) => {
          calls.push('upload');
          return {
            success: true,
            key,
            url: `https://assets.example.com/${key}`,
          };
        },
        deleteFiles: async () => {
          calls.push('delete');
        },
      },
      createAsset: async (asset) => {
        calls.push('asset');
        return {
          createdAt: new Date('2026-05-06T00:00:00Z'),
          updatedAt: new Date('2026-05-06T00:00:00Z'),
          deletedAt: null,
          ...asset,
        };
      },
      commitReservation: async () => {
        calls.push('commit');
      },
      refundReservation: async () => {
        calls.push('refund');
      },
    },
  });

  assert.deepEqual(calls, ['reserve', 'upload', 'asset', 'commit']);
});
