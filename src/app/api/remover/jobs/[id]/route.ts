import { createApiContext } from '@/app/api/_lib/context';
import {
  claimRemoverJobForActor,
  getRemoverJobForActor,
} from '@/domains/remover/application/jobs';
import {
  refreshRemoverJobStatus,
  submitRemoverJobToProvider,
} from '@/domains/remover/application/processing';
import {
  claimRemoverImageAssetsByKeys,
  findActiveRemoverImageAssetById,
} from '@/domains/remover/infra/image-asset';
import {
  claimRemoverJobById,
  claimRemoverJobForProviderSubmission,
  findRemoverJobById,
  updateRemoverJobById,
  withRemoverJobOutputStorageLock,
} from '@/domains/remover/infra/job';
import {
  claimRemoverQuotaReservationById,
  commitRemoverQuotaReservation,
  refundRemoverQuotaReservation,
} from '@/domains/remover/infra/quota-reservation';

import { withApi } from '@/shared/lib/api/route';

import { requireRemoverSite } from '../../_lib/guard';
import { resolveRemoverActor } from '../../actor.server';
import { resolveRemoverProviderAdapter } from '../../provider-adapter.server';
import { storeRemoverJobOutputImage } from '../output-storage.server';
import { createRemoverJobGetAction } from './action';

const getAction = createRemoverJobGetAction({
  createApiContext,
  resolveActor: resolveRemoverActor,
  getRemoverJobForActor,
  claimRemoverJobForActor,
  refreshRemoverJobStatus,
  submitRemoverJobToProvider,
  resolveProviderAdapter: resolveRemoverProviderAdapter,
  jobDeps: {
    findJobById: findRemoverJobById,
  },
  claimDeps: {
    claimJobById: claimRemoverJobById,
    claimAssetsByKeys: claimRemoverImageAssetsByKeys,
    claimReservationById: claimRemoverQuotaReservationById,
  },
  refreshDeps: {
    findJobById: findRemoverJobById,
    updateJob: updateRemoverJobById,
    commitReservation: commitRemoverQuotaReservation,
    refundReservation: refundRemoverQuotaReservation,
    withOutputStorageLock: withRemoverJobOutputStorageLock,
    storeOutputImage: storeRemoverJobOutputImage,
  },
  submitDeps: {
    findJobById: findRemoverJobById,
    findAsset: findActiveRemoverImageAssetById,
    updateJob: updateRemoverJobById,
    claimJobForProviderSubmission: claimRemoverJobForProviderSubmission,
    commitReservation: commitRemoverQuotaReservation,
    refundReservation: refundRemoverQuotaReservation,
    withOutputStorageLock: withRemoverJobOutputStorageLock,
    storeOutputImage: storeRemoverJobOutputImage,
  },
});

export const GET = withApi(
  (req: Request, context: { params: Promise<{ id: string }> }) => {
    requireRemoverSite();
    return getAction(req, { routeParams: context.params });
  }
);
