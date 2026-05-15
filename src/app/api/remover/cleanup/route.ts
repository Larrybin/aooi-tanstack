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

import {
  ForbiddenError,
  NotFoundError,
} from '@/shared/lib/api/errors';
import { jsonOk } from '@/shared/lib/api/response';
import { withApi } from '@/shared/lib/api/route';

import { requireRemoverSite } from '../_lib/guard';

function assertCleanupSecret(req: Request) {
  const secret = getRuntimeEnvString('REMOVER_CLEANUP_SECRET')?.trim() || '';
  if (!secret) {
    throw new NotFoundError('not found');
  }

  const authorization = req.headers.get('authorization')?.trim() || '';
  if (authorization !== `Bearer ${secret}`) {
    throw new ForbiddenError('forbidden');
  }
}

export const POST = withApi(async (req: Request) => {
  requireRemoverSite();
  assertCleanupSecret(req);
  const result = await cleanupExpiredRemoverImages({
    deps: {
      listExpiredJobs: listExpiredRemoverJobs,
      listExpiredAssets: listExpiredRemoverImageAssets,
      markJobsDeletedByIds: markRemoverJobsDeletedByIds,
      markAssetsDeletedByKeys: markRemoverImageAssetsDeletedByKeysAnyOwner,
      storageService: await getStorageService(),
    },
  });

  return jsonOk(result, {
    headers: { 'Cache-Control': 'no-store' },
  });
});
