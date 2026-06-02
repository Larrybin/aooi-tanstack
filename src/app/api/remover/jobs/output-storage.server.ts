import { storeRemoverOutputImage } from '@/domains/remover/application/output';
import { createRemoverImageAssets } from '@/domains/remover/infra/image-asset';
import type { RemoverJob } from '@/domains/remover/infra/job';
import { getStorageService } from '@/infra/adapters/storage/service';

export async function storeRemoverJobOutputImage({
  job,
  outputImageUrl,
}: {
  job: RemoverJob;
  outputImageUrl: string;
}) {
  const result = await storeRemoverOutputImage({
    job,
    outputImageUrl,
    deps: {
      storageService: await getStorageService(),
      createAssets: createRemoverImageAssets,
    },
  });

  return {
    outputStorageKey: result.outputAsset.storageKey,
    thumbnailStorageKey: result.thumbnailAsset.storageKey,
  };
}
