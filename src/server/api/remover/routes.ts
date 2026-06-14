import {
  reserveHighResDownloadQuota,
  resolveRemoverDownload,
} from '@/domains/remover/application/download';
import {
  claimRemoverJobForActor,
  createQueuedRemoverJob,
  getRemoverJobForActor,
} from '@/domains/remover/application/jobs';
import {
  refreshRemoverJobStatus,
  submitRemoverJobToProvider,
} from '@/domains/remover/application/processing';
import {
  claimRemoverImageAssetsByKeys,
  createRemoverImageAsset,
  findActiveRemoverImageAssetById,
} from '@/domains/remover/infra/image-asset';
import {
  claimRemoverJobById,
  claimRemoverJobForProviderSubmission,
  createRemoverJobWithQuotaReservation,
  findRemoverJobById,
  findRemoverJobByQuotaReservationId,
  updateRemoverJobById,
  withRemoverJobOutputStorageLock,
} from '@/domains/remover/infra/job';
import {
  claimRemoverQuotaReservationById,
  commitRemoverQuotaReservation,
  findRemoverQuotaReservationByIdempotencyKey,
  refundRemoverQuotaReservation,
  reserveRemoverQuota,
} from '@/domains/remover/infra/quota-reservation';
import { getStorageService } from '@/infra/adapters/storage/service';

import { createLimiterFactory } from '@/shared/lib/api/limiters-factory';
import { withApi } from '@/shared/lib/api/route';
import { readUploadRequestInput } from '@/shared/lib/runtime/upload';

import { detectAllowedImageMime } from '../storage/image-mime';
import { resolveRemoverActor } from './actor';
import { createRemoverApiContext } from './context';
import {
  createRemoverDownloadGetAction,
  createRemoverDownloadPostAction,
} from './download-action';
import { requireRemoverSite } from './guard';
import { acquireRemoverGuestIpLimit } from './guest-ip-limit';
import { createRemoverJobGetAction } from './job-action';
import { createRemoverJobsPostAction } from './jobs-action';
import { storeRemoverJobOutputImage } from './output-storage';
import { resolveRemoverProviderAdapter } from './provider-adapter';
import { createRemoverUploadPostAction } from './upload-action';

const REMOVER_UPLOAD_REQUEST_BYTES = 22 * 1024 * 1024;

type PendingResponseHeaders = {
  appendSetCookie(value: string): void;
  apply(response: Response): Response;
};

function createPendingResponseHeaders(): PendingResponseHeaders {
  const setCookies: string[] = [];

  return {
    appendSetCookie(value) {
      setCookies.push(value);
    },
    apply(response) {
      if (!setCookies.length) {
        return response;
      }

      const headers = new Headers(response.headers);
      for (const setCookie of setCookies) {
        headers.append('set-cookie', setCookie);
      }

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    },
  };
}

function createRemoverRequestDeps() {
  const responseHeaders = createPendingResponseHeaders();

  return {
    responseHeaders,
    resolveActor: (req: Request) => resolveRemoverActor(req, responseHeaders),
  };
}

function withRemoverApi(
  handler: (req: Request, context?: unknown) => Promise<Response> | Response
) {
  return withApi((req: Request, context?: unknown) => {
    requireRemoverSite();
    return handler(req, context);
  });
}

export const postRemoverUpload = withRemoverApi(async (req) => {
  const { responseHeaders, resolveActor } = createRemoverRequestDeps();
  const postAction = createRemoverUploadPostAction({
    createApiContext: createRemoverApiContext,
    resolveActor,
    readUploadRequestInput: (nextReq, fieldName) =>
      readUploadRequestInput(nextReq, fieldName, REMOVER_UPLOAD_REQUEST_BYTES),
    getStorageService,
    detectImageMime: detectAllowedImageMime,
    createAsset: createRemoverImageAsset,
    reserveUploadQuota: reserveRemoverQuota,
    commitReservation: commitRemoverQuotaReservation,
    refundReservation: refundRemoverQuotaReservation,
    acquireGuestIpLimit: ({ actor, req: nextReq }) =>
      acquireRemoverGuestIpLimit({
        actor,
        req: nextReq,
        limiter: createLimiterFactory().createRemoverGuestUploadLimiter(),
      }),
  });

  return responseHeaders.apply(await postAction(req));
});

export const postRemoverJobs = withRemoverApi(async (req) => {
  const { responseHeaders, resolveActor } = createRemoverRequestDeps();
  const postAction = createRemoverJobsPostAction({
    createApiContext: createRemoverApiContext,
    resolveActor,
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
      storeOutputImage: storeRemoverJobOutputImage,
    },
    acquireGuestIpLimit: ({ actor, req: nextReq }) =>
      acquireRemoverGuestIpLimit({
        actor,
        req: nextReq,
        limiter: createLimiterFactory().createRemoverGuestJobLimiter(),
      }),
  });

  return responseHeaders.apply(await postAction(req));
});

export const getRemoverJob = withRemoverApi(async (req, context?: unknown) => {
  const { responseHeaders, resolveActor } = createRemoverRequestDeps();
  const getAction = createRemoverJobGetAction({
    createApiContext: createRemoverApiContext,
    resolveActor,
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

  return responseHeaders.apply(
    await getAction(req, {
      routeParams:
        typeof context === 'object' && context && 'params' in context
          ? (context as { params: unknown }).params
          : {},
    })
  );
});

function createDownloadAction(variant: 'low_res' | 'high_res') {
  return async (req: Request, method: 'GET' | 'POST') => {
    const { responseHeaders, resolveActor } = createRemoverRequestDeps();
    const deps = {
      createApiContext: createRemoverApiContext,
      resolveActor,
      resolveDownload: resolveRemoverDownload,
      reserveHighResQuota: reserveHighResDownloadQuota,
      getStorageService,
      downloadDeps: {
        findJobById: findRemoverJobById,
        findReservationByIdempotencyKey:
          findRemoverQuotaReservationByIdempotencyKey,
        reserveQuota: reserveRemoverQuota,
        commitReservation: commitRemoverQuotaReservation,
      },
    };
    const action =
      method === 'GET' && variant === 'low_res'
        ? createRemoverDownloadGetAction(deps, 'low_res')
        : createRemoverDownloadPostAction(deps, variant);

    return responseHeaders.apply(await action(req));
  };
}

export const postRemoverLowResDownload = withRemoverApi((req) =>
  createDownloadAction('low_res')(req, 'POST')
);

export const getRemoverLowResDownload = withRemoverApi((req) =>
  createDownloadAction('low_res')(req, 'GET')
);

export const postRemoverHighResDownload = withRemoverApi((req) =>
  createDownloadAction('high_res')(req, 'POST')
);
