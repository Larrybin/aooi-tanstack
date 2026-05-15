import assert from 'node:assert/strict';
import test from 'node:test';

import type { RemoverImageAsset } from '../infra/image-asset';
import type { RemoverJob } from '../infra/job';
import { cleanupExpiredRemoverImages } from './cleanup';

function expiredJob(overrides: Partial<RemoverJob> = {}): RemoverJob {
  return {
    id: 'job_1',
    userId: 'user_1',
    anonymousSessionId: null,
    provider: 'cloudflare-workers-ai',
    model: '@cf/model',
    providerTaskId: 'provider_task_1',
    status: 'succeeded',
    inputImageAssetId: 'input_asset',
    maskImageAssetId: 'mask_asset',
    inputImageKey: 'input.png',
    maskImageKey: 'mask.png',
    outputImageKey: 'output.png',
    thumbnailKey: 'output.png',
    costUnits: 1,
    quotaReservationId: 'reservation_1',
    errorCode: null,
    errorMessage: null,
    createdAt: new Date('2026-05-01T00:00:00Z'),
    updatedAt: new Date('2026-05-01T00:00:00Z'),
    deletedAt: null,
    expiresAt: new Date('2026-05-02T00:00:00Z'),
    ...overrides,
  };
}

function expiredAsset(storageKey: string): RemoverImageAsset {
  return {
    id: `asset_${storageKey}`,
    userId: 'user_1',
    anonymousSessionId: null,
    kind: 'output',
    storageKey,
    url: `https://assets.example.com/${storageKey}`,
    mimeType: 'image/png',
    byteSize: 10,
    width: 1,
    height: 1,
    status: 'active',
    createdAt: new Date('2026-05-01T00:00:00Z'),
    updatedAt: new Date('2026-05-01T00:00:00Z'),
    deletedAt: null,
    expiresAt: new Date('2026-05-02T00:00:00Z'),
  };
}

test('cleanupExpiredRemoverImages deletes unique storage keys and marks records', async () => {
  const deletedStorageKeys: string[] = [];
  const markedJobIds: string[] = [];
  const markedAssetKeys: string[] = [];

  const result = await cleanupExpiredRemoverImages({
    deps: {
      listExpiredJobs: async () => [expiredJob()],
      listExpiredAssets: async () => [
        expiredAsset('output.png'),
        expiredAsset('orphan.png'),
      ],
      markJobsDeletedByIds: async ({ ids }) => {
        markedJobIds.push(...ids);
      },
      markAssetsDeletedByKeys: async ({ storageKeys }) => {
        markedAssetKeys.push(...storageKeys);
      },
      storageService: {
        deleteFiles: async (keys) => {
          deletedStorageKeys.push(...keys);
        },
      },
      now: () => new Date('2026-05-06T00:00:00Z'),
    },
  });

  assert.deepEqual(deletedStorageKeys, [
    'input.png',
    'mask.png',
    'output.png',
    'orphan.png',
  ]);
  assert.deepEqual(markedAssetKeys, deletedStorageKeys);
  assert.deepEqual(markedJobIds, ['job_1']);
  assert.deepEqual(result, {
    deletedJobs: 1,
    deletedAssets: 4,
  });
});
