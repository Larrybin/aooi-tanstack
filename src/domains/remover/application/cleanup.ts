import type { StorageService } from '@/infra/adapters/storage/service-builder';

import type { RemoverImageAsset } from '../infra/image-asset';
import type { RemoverJob } from '../infra/job';

type CleanupDeps = {
  listExpiredJobs: (input: {
    now: Date;
    limit?: number;
  }) => Promise<RemoverJob[]>;
  listExpiredAssets: (input: {
    now: Date;
    limit?: number;
  }) => Promise<RemoverImageAsset[]>;
  markJobsDeletedByIds: (input: {
    ids: string[];
    now?: Date;
  }) => Promise<unknown>;
  markAssetsDeletedByKeys: (input: {
    storageKeys: string[];
    now?: Date;
  }) => Promise<unknown>;
  storageService: Pick<StorageService, 'deleteFiles'>;
  now?: () => Date;
};

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function jobStorageKeys(job: RemoverJob): string[] {
  return [
    job.inputImageKey,
    job.maskImageKey,
    job.outputImageKey || '',
    job.thumbnailKey || '',
  ].filter(Boolean);
}

export async function cleanupExpiredRemoverImages({
  limit = 100,
  deps,
}: {
  limit?: number;
  deps: CleanupDeps;
}) {
  const now = (deps.now ?? (() => new Date()))();
  const [jobs, assets] = await Promise.all([
    deps.listExpiredJobs({ now, limit }),
    deps.listExpiredAssets({ now, limit: limit * 4 }),
  ]);
  const jobKeys = jobs.flatMap(jobStorageKeys);
  const assetKeys = assets.map((asset) => asset.storageKey);
  const storageKeys = unique([...jobKeys, ...assetKeys]);

  if (storageKeys.length) {
    await deps.storageService.deleteFiles(storageKeys);
    await deps.markAssetsDeletedByKeys({ storageKeys, now });
  }

  if (jobs.length) {
    await deps.markJobsDeletedByIds({
      ids: jobs.map((job) => job.id),
      now,
    });
  }

  return {
    deletedJobs: jobs.length,
    deletedAssets: storageKeys.length,
  };
}
