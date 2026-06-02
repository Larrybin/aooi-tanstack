import { createApiContext } from '@/app/api/_lib/context';
import { createQueuedRemoverJob } from '@/domains/remover/application/jobs';
import { storeRemoverOutputImage } from '@/domains/remover/application/output';
import { submitRemoverJobToProvider } from '@/domains/remover/application/processing';
import {
  createRemoverImageAssets,
  findActiveRemoverImageAssetById,
} from '@/domains/remover/infra/image-asset';
import {
  claimRemoverJobForProviderSubmission,
  createRemoverJobWithQuotaReservation,
  findRemoverJobById,
  findRemoverJobByQuotaReservationId,
  updateRemoverJobById,
  withRemoverJobOutputStorageLock,
} from '@/domains/remover/infra/job';
import {
  commitRemoverQuotaReservation,
  findRemoverQuotaReservationByIdempotencyKey,
  refundRemoverQuotaReservation,
} from '@/domains/remover/infra/quota-reservation';
import { getStorageService } from '@/infra/adapters/storage/service';

import { createLimiterFactory } from '@/shared/lib/api/limiters-factory';
import { withApi } from '@/shared/lib/api/route';

import { requireRemoverSite } from '../_lib/guard';
import { resolveRemoverActor } from '../actor.server';
import { acquireRemoverGuestIpLimit } from '../guest-ip-limit';
import { resolveRemoverProviderAdapter } from '../provider-adapter.server';
import { createRemoverJobsPostAction } from './action';

const postAction = createRemoverJobsPostAction({
  createApiContext,
  resolveActor: resolveRemoverActor,
  createQueuedRemoverJob,
  resolveProviderAdapter: resolveRemoverProviderAdapter,
  submitRemoverJobToProvider,
  jobDeps: {
    findAsset: findActiveRemoverImageAssetById,
    findReservationByIdempotencyKey:
      findRemoverQuotaReservationByIdempotencyKey,
    createJobWithReservation: createRemoverJobWithQuotaReservation,
    findJobByQuotaReservationId: findRemoverJobByQuotaReservationId,
  },
  submitDeps: {
    findJobById: findRemoverJobById,
    findAsset: findActiveRemoverImageAssetById,
    updateJob: updateRemoverJobById,
    claimJobForProviderSubmission: claimRemoverJobForProviderSubmission,
    commitReservation: commitRemoverQuotaReservation,
    refundReservation: refundRemoverQuotaReservation,
    withOutputStorageLock: withRemoverJobOutputStorageLock,
    storeOutputImage: async ({ job, outputImageUrl }) => {
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
    },
  },
  acquireGuestIpLimit: ({ actor, req }) =>
    acquireRemoverGuestIpLimit({
      actor,
      req,
      limiter: createLimiterFactory().createRemoverGuestJobLimiter(),
    }),
});

export const POST = withApi((req: Request) => {
  requireRemoverSite();
  return postAction(req);
});
