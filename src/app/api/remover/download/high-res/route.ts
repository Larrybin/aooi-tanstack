import { createApiContext } from '@/app/api/_lib/context';
import {
  reserveHighResDownloadQuota,
  resolveRemoverDownload,
} from '@/domains/remover/application/download';
import { findRemoverJobById } from '@/domains/remover/infra/job';
import {
  commitRemoverQuotaReservation,
  createRemoverQuotaReservationWithQuotaCheck,
  findRemoverQuotaReservationByIdempotencyKey,
} from '@/domains/remover/infra/quota-reservation';
import { getStorageService } from '@/infra/adapters/storage/service';

import { withApi } from '@/shared/lib/api/route';

import { requireRemoverSite } from '../../_lib/guard';
import { resolveRemoverActor } from '../../actor.server';
import { createRemoverDownloadPostAction } from '../action';

const postAction = createRemoverDownloadPostAction(
  {
    createApiContext,
    resolveActor: resolveRemoverActor,
    resolveDownload: resolveRemoverDownload,
    reserveHighResQuota: reserveHighResDownloadQuota,
    getStorageService,
    downloadDeps: {
      findJobById: findRemoverJobById,
      findReservationByIdempotencyKey: findRemoverQuotaReservationByIdempotencyKey,
      reserveQuota: createRemoverQuotaReservationWithQuotaCheck,
      commitReservation: commitRemoverQuotaReservation,
    },
  },
  'high_res'
);

export const POST = withApi((req: Request) => {
  requireRemoverSite();
  return postAction(req);
});
