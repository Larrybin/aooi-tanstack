import assert from 'node:assert/strict';
import test from 'node:test';

import { ForbiddenError, NotFoundError } from '@/shared/lib/api/errors';

import type { RemoverActor } from '../domain/types';
import type { RemoverJob } from '../infra/job';
import {
  reserveHighResDownloadQuota,
  resolveRemoverDownload,
} from './download';

const anonymousActor = {
  kind: 'anonymous',
  anonymousSessionId: 'anon_1',
} satisfies RemoverActor;

const userActor = {
  kind: 'user',
  userId: 'user_1',
  productId: 'free',
  anonymousSessionId: 'anon_1',
} satisfies RemoverActor;

function job(overrides: Partial<RemoverJob> = {}): RemoverJob {
  return {
    id: 'job_1',
    userId: null,
    anonymousSessionId: 'anon_1',
    provider: 'cloudflare-workers-ai',
    model: '@cf/model',
    providerTaskId: 'provider_task_1',
    status: 'succeeded',
    inputImageAssetId: 'input_asset',
    maskImageAssetId: 'mask_asset',
    inputImageKey: 'input.png',
    maskImageKey: 'mask.png',
    outputImageKey: 'output.png',
    thumbnailKey: 'thumbnail.png',
    costUnits: 1,
    quotaReservationId: 'reservation_1',
    errorCode: null,
    errorMessage: null,
    createdAt: new Date('2026-05-06T00:00:00Z'),
    updatedAt: new Date('2026-05-06T00:00:00Z'),
    deletedAt: null,
    expiresAt: new Date('2026-05-07T00:00:00Z'),
    ...overrides,
  };
}

function deps(savedJob: RemoverJob) {
  let committedReservationId = '';

  return {
    deps: {
      findJobById: async () => savedJob,
      findReservationByIdempotencyKey: async () => undefined,
      reserveQuota: async ({ reservation }) => ({
        reservation: {
          ...reservation,
          jobId: reservation.jobId ?? null,
          reason: reservation.reason ?? null,
          createdAt: new Date('2026-05-06T00:00:00Z'),
          updatedAt: new Date('2026-05-06T00:00:00Z'),
          committedAt: null,
          refundedAt: null,
        },
        reused: false,
      }),
      commitReservation: async ({ reservationId }) => {
        committedReservationId = reservationId;
      },
    } satisfies Parameters<typeof resolveRemoverDownload>[0]['deps'],
    get committedReservationId() {
      return committedReservationId;
    },
  };
}

test('resolveRemoverDownload returns thumbnail key for anonymous low-res downloads', async () => {
  const result = await resolveRemoverDownload({
    actor: anonymousActor,
    jobId: 'job_1',
    variant: 'low_res',
    deps: deps(job()).deps,
  });

  assert.equal(result.storageKey, 'thumbnail.png');
  assert.equal(result.filename, 'ai-remover-job_1-low-res.png');
  assert.equal(result.quotaReservationIdToCommit, undefined);
});

test('resolveRemoverDownload does not fall back to high-res output for low-res downloads', async () => {
  await assert.rejects(
    resolveRemoverDownload({
      actor: anonymousActor,
      jobId: 'job_1',
      variant: 'low_res',
      deps: deps(job({ thumbnailKey: null })).deps,
    }),
    NotFoundError
  );
});

test('resolveRemoverDownload rejects high-res downloads for anonymous actors', async () => {
  await assert.rejects(
    resolveRemoverDownload({
      actor: anonymousActor,
      jobId: 'job_1',
      variant: 'high_res',
      deps: deps(job()).deps,
    }),
    ForbiddenError
  );
});

test('resolveRemoverDownload rejects unfinished jobs', async () => {
  await assert.rejects(
    resolveRemoverDownload({
      actor: anonymousActor,
      jobId: 'job_1',
      variant: 'low_res',
      deps: deps(job({ status: 'processing', outputImageKey: null })).deps,
    }),
    NotFoundError
  );
});

test('resolveRemoverDownload marks high-res downloads as quota-gated without reserving', async () => {
  const state = deps(
    job({
      userId: 'user_1',
      anonymousSessionId: null,
    })
  );

  const result = await resolveRemoverDownload({
    actor: userActor,
    jobId: 'job_1',
    variant: 'high_res',
    deps: state.deps,
  });

  assert.equal(result.storageKey, 'output.png');
  assert.equal(result.requiresHighResQuota, true);
  assert.equal(result.quotaReservationIdToCommit, undefined);
  assert.equal(state.committedReservationId, '');
});

test('reserveHighResDownloadQuota checks signed-in high-res quota by user only', async () => {
  let quotaOwner:
    | { userId: string | null; anonymousSessionId: string | null }
    | undefined;
  const state = deps(
    job({
      userId: 'user_1',
      anonymousSessionId: null,
    })
  );

  await reserveHighResDownloadQuota({
    actor: {
      kind: 'user',
      userId: 'user_1',
      productId: 'free',
      anonymousSessionId: 'anon_2',
    },
    job: job({
      userId: 'user_1',
      anonymousSessionId: null,
    }),
    deps: {
      ...state.deps,
      reserveQuota: async ({ reservation, quota }) => {
        quotaOwner = {
          userId: quota.userId,
          anonymousSessionId: quota.anonymousSessionId,
        };
        return {
          reservation: {
            ...reservation,
            jobId: reservation.jobId ?? null,
            reason: reservation.reason ?? null,
            createdAt: new Date('2026-05-06T00:00:00Z'),
            updatedAt: new Date('2026-05-06T00:00:00Z'),
            committedAt: null,
            refundedAt: null,
          },
          reused: false,
        };
      },
    },
  });

  assert.deepEqual(quotaOwner, {
    userId: 'user_1',
    anonymousSessionId: null,
  });
});

test('reserveHighResDownloadQuota delegates quota check and reservation atomically', async () => {
  let quotaInput:
    | {
        quotaType: string;
        limit: number;
        requestedUnits: number;
        idempotencyKey: string;
        jobId: string | null | undefined;
      }
    | undefined;
  const state = deps(
    job({
      userId: 'user_1',
      anonymousSessionId: null,
    })
  );

  const reservationId = await reserveHighResDownloadQuota({
    actor: userActor,
    job: job({
      userId: 'user_1',
      anonymousSessionId: null,
    }),
    deps: {
      ...state.deps,
      reserveQuota: async ({ reservation, quota }) => {
        quotaInput = {
          quotaType: quota.quotaType,
          limit: quota.limit,
          requestedUnits: quota.requestedUnits,
          idempotencyKey: reservation.idempotencyKey,
          jobId: reservation.jobId,
        };
        return {
          reservation: {
            ...reservation,
            id: 'download_reservation_1',
            jobId: reservation.jobId ?? null,
            reason: null,
            createdAt: new Date('2026-05-06T00:00:00Z'),
            updatedAt: new Date('2026-05-06T00:00:00Z'),
            committedAt: null,
            refundedAt: null,
          },
          reused: false,
        };
      },
    },
  });

  assert.equal(reservationId, 'download_reservation_1');
  assert.deepEqual(quotaInput, {
    quotaType: 'high_res_download',
    limit: 3,
    requestedUnits: 1,
    idempotencyKey: 'high-res-download:user_1:job_1',
    jobId: 'job_1',
  });
});

test('reserveHighResDownloadQuota reuses committed high-res reservations', async () => {
  let reserveQuotaCalled = false;
  const existingReservation = {
    id: 'download_reservation_committed',
    userId: 'user_1',
    anonymousSessionId: null,
    productId: 'free',
    quotaType: 'high_res_download',
    units: 1,
    status: 'committed',
    idempotencyKey: 'high-res-download:user_1:job_1',
    jobId: 'job_1',
    reason: null,
    createdAt: new Date('2026-05-06T00:00:00Z'),
    updatedAt: new Date('2026-05-06T00:00:00Z'),
    committedAt: new Date('2026-05-06T00:00:00Z'),
    refundedAt: null,
    expiresAt: new Date('2026-05-06T01:00:00Z'),
  };
  const state = deps(
    job({
      userId: 'user_1',
      anonymousSessionId: null,
    })
  );

  const reservationId = await reserveHighResDownloadQuota({
    actor: userActor,
    job: job({
      userId: 'user_1',
      anonymousSessionId: null,
    }),
    deps: {
      ...state.deps,
      findReservationByIdempotencyKey: async () => existingReservation,
      reserveQuota: async (input) => {
        reserveQuotaCalled = true;
        return state.deps.reserveQuota(input);
      },
      now: () => new Date('2026-05-07T00:00:00Z'),
    },
  });

  assert.equal(reservationId, 'download_reservation_committed');
  assert.equal(reserveQuotaCalled, false);
});

test('reserveHighResDownloadQuota renews expired reserved high-res reservations through quota check', async () => {
  let quotaChecked = false;
  const existingReservation = {
    id: 'download_reservation_expired',
    userId: 'user_1',
    anonymousSessionId: null,
    productId: 'free',
    quotaType: 'high_res_download',
    units: 1,
    status: 'reserved',
    idempotencyKey: 'high-res-download:user_1:job_1',
    jobId: 'job_1',
    reason: null,
    createdAt: new Date('2026-05-06T00:00:00Z'),
    updatedAt: new Date('2026-05-06T00:00:00Z'),
    committedAt: null,
    refundedAt: null,
    expiresAt: new Date('2026-05-06T01:00:00Z'),
  };
  const state = deps(
    job({
      userId: 'user_1',
      anonymousSessionId: null,
    })
  );

  const reservationId = await reserveHighResDownloadQuota({
    actor: userActor,
    job: job({
      userId: 'user_1',
      anonymousSessionId: null,
    }),
    deps: {
      ...state.deps,
      findReservationByIdempotencyKey: async () => existingReservation,
      reserveQuota: async ({ reservation, quota }) => {
        quotaChecked = true;
        assert.equal(reservation.idempotencyKey, existingReservation.idempotencyKey);
        assert.equal(quota.quotaType, 'high_res_download');
        return {
          reservation: {
            ...reservation,
            id: existingReservation.id,
            jobId: reservation.jobId ?? null,
            reason: null,
            createdAt: new Date('2026-05-07T00:00:00Z'),
            updatedAt: new Date('2026-05-07T00:00:00Z'),
            committedAt: null,
            refundedAt: null,
          },
          reused: false,
        };
      },
      now: () => new Date('2026-05-07T00:00:00Z'),
    },
  });

  assert.equal(reservationId, 'download_reservation_expired');
  assert.equal(quotaChecked, true);
});
