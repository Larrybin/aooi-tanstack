import { createApiContext } from '@/app/api/_lib/context';
import {
  createRemoverImageAsset,
} from '@/domains/remover/infra/image-asset';
import {
  commitRemoverQuotaReservation,
  createRemoverQuotaReservationWithQuotaCheck,
  refundRemoverQuotaReservation,
} from '@/domains/remover/infra/quota-reservation';
import { getStorageService } from '@/infra/adapters/storage/service';

import { createLimiterFactory } from '@/shared/lib/api/limiters-factory';
import { withApi } from '@/shared/lib/api/route';
import { readUploadRequestInput } from '@/shared/lib/runtime/upload';

import { detectAllowedImageMime } from '../../storage/upload-image/upload-image-files';
import { requireRemoverSite } from '../_lib/guard';
import { resolveRemoverActor } from '../actor.server';
import { acquireRemoverGuestIpLimit } from '../guest-ip-limit';
import { createRemoverUploadPostAction } from './action';

const REMOVER_UPLOAD_REQUEST_BYTES = 22 * 1024 * 1024;

const postAction = createRemoverUploadPostAction({
  createApiContext,
  resolveActor: resolveRemoverActor,
  readUploadRequestInput: (req, fieldName) =>
    readUploadRequestInput(req, fieldName, REMOVER_UPLOAD_REQUEST_BYTES),
  getStorageService,
  detectImageMime: detectAllowedImageMime,
  createAsset: createRemoverImageAsset,
  reserveUploadQuota: createRemoverQuotaReservationWithQuotaCheck,
  commitReservation: commitRemoverQuotaReservation,
  refundReservation: refundRemoverQuotaReservation,
  acquireGuestIpLimit: ({ actor, req }) =>
    acquireRemoverGuestIpLimit({
      actor,
      req,
      limiter: createLimiterFactory().createRemoverGuestUploadLimiter(),
    }),
});

export const POST = withApi((req: Request) => {
  requireRemoverSite();
  return postAction(req);
});
