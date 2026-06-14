import { cleanupExpiredRemoverImages } from '@/domains/remover/application/cleanup';
import {
  listExpiredRemoverImageAssets,
  markRemoverImageAssetsDeletedByKeysAnyOwner,
} from '@/domains/remover/infra/image-asset';
import {
  listExpiredRemoverJobs,
  markRemoverJobsDeletedByIds,
} from '@/domains/remover/infra/job';
import { getStorageService } from '@/infra/adapters/storage/service';
import { getRuntimeEnvString } from '@/infra/runtime/env.server';

import { ForbiddenError, NotFoundError } from '@/shared/lib/api/errors';
import { jsonOk } from '@/shared/lib/api/response';
import { withApi } from '@/shared/lib/api/route';

import { requireRemoverSite } from './guard';

type RemoverCleanupResult = Awaited<
  ReturnType<typeof cleanupExpiredRemoverImages>
>;

type CreateRemoverCleanupPostHandlerDeps = {
  requireSite: () => void;
  getCleanupSecret: () => string | undefined;
  cleanupExpiredImages: () => Promise<RemoverCleanupResult>;
};

function assertCleanupSecret(req: Request, secret: string | undefined) {
  const normalizedSecret = secret?.trim() || '';
  if (!normalizedSecret) {
    throw new NotFoundError('not found');
  }

  const authorization = req.headers.get('authorization')?.trim() || '';
  if (authorization !== `Bearer ${normalizedSecret}`) {
    throw new ForbiddenError('forbidden');
  }
}

export function createRemoverCleanupPostHandler(
  deps: CreateRemoverCleanupPostHandlerDeps
) {
  return withApi(async (req: Request) => {
    deps.requireSite();
    assertCleanupSecret(req, deps.getCleanupSecret());

    return jsonOk(await deps.cleanupExpiredImages(), {
      headers: { 'Cache-Control': 'no-store' },
    });
  });
}

export const postRemoverCleanup = createRemoverCleanupPostHandler({
  requireSite: requireRemoverSite,
  getCleanupSecret: () => getRuntimeEnvString('REMOVER_CLEANUP_SECRET'),
  cleanupExpiredImages: async () =>
    cleanupExpiredRemoverImages({
      deps: {
        listExpiredJobs: listExpiredRemoverJobs,
        listExpiredAssets: listExpiredRemoverImageAssets,
        markJobsDeletedByIds: markRemoverJobsDeletedByIds,
        markAssetsDeletedByKeys: markRemoverImageAssetsDeletedByKeysAnyOwner,
        storageService: await getStorageService(),
      },
    }),
});
