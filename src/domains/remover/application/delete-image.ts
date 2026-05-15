import type { StorageService } from '@/infra/adapters/storage/service-builder';

import type { RemoverJob } from '../infra/job';

type DeleteRemoverJobImagesDeps = {
  findJobById: (jobId: string) => Promise<RemoverJob | undefined>;
  getStorageService: () => Promise<Pick<StorageService, 'deleteFiles'>>;
  markJobDeleted: (input: {
    id: string;
    userId: string;
  }) => Promise<RemoverJob | undefined>;
  markAssetsDeleted: (input: {
    userId: string;
    storageKeys: string[];
  }) => Promise<unknown>;
};

function getRemoverJobStorageKeys(job: RemoverJob): string[] {
  return [
    job.inputImageKey,
    job.maskImageKey,
    job.outputImageKey || '',
    job.thumbnailKey || '',
  ].filter(Boolean);
}

export async function deleteRemoverJobImagesForUser({
  jobId,
  userId,
  deps,
}: {
  jobId: string;
  userId: string;
  deps: DeleteRemoverJobImagesDeps;
}) {
  const job = await deps.findJobById(jobId);
  if (!job || job.userId !== userId) {
    return false;
  }

  const storageKeys = getRemoverJobStorageKeys(job);
  const storage = await deps.getStorageService();
  await storage.deleteFiles(storageKeys);
  await deps.markJobDeleted({ id: jobId, userId });
  await deps.markAssetsDeleted({ userId, storageKeys });
  return true;
}
