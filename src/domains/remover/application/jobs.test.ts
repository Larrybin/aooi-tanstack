import assert from 'node:assert/strict';
import test from 'node:test';

import { TooManyRequestsError } from '@/shared/lib/api/errors';

import type { RemoverActor } from '../domain/types';
import type { RemoverImageAsset } from '../infra/image-asset';
import type { RemoverJob } from '../infra/job';
import type { RemoverQuotaReservation } from '../infra/quota-reservation';
import {
  claimRemoverJobForActor,
  createQueuedRemoverJob,
  getRemoverJobForActor,
  listMyRemoverJobsForActor,
} from './jobs';

const actor = {
  kind: 'anonymous',
  anonymousSessionId: 'anon_1',
} satisfies RemoverActor;

const providerConfig = {
  provider: 'replicate',
  model: 'test/remover',
};

function asset(id: string, kind: 'original' | 'mask'): RemoverImageAsset {
  return {
    id,
    userId: null,
    anonymousSessionId: 'anon_1',
    kind,
    storageKey: `remover/anonymous/anon_1/${kind}/${id}.png`,
    url: `https://assets.example.com/${id}.png`,
    mimeType: 'image/png',
    byteSize: 100,
    width: null,
    height: null,
    status: 'active',
    createdAt: new Date('2026-05-06T00:00:00Z'),
    updatedAt: new Date('2026-05-06T00:00:00Z'),
    deletedAt: null,
    expiresAt: new Date('2026-05-07T00:00:00Z'),
  };
}

function createDeps({ usedUnits = 0 }: { usedUnits?: number } = {}) {
  const reservations: RemoverQuotaReservation[] = [];
  const jobs: RemoverJob[] = [];
  let idCounter = 0;

  return {
    reservations,
    jobs,
    deps: {
      findAsset: async (id: string) =>
        id === 'input_1'
          ? asset('input_1', 'original')
          : id === 'mask_1'
            ? asset('mask_1', 'mask')
            : undefined,
      findReservationByIdempotencyKey: async (key: string) =>
        reservations.find((reservation) => reservation.idempotencyKey === key),
      createJobWithReservation: async ({ reservation, job, quota }) => {
        if (usedUnits + quota.requestedUnits > quota.limit) {
          throw new TooManyRequestsError('remover quota exceeded', {
            limit: quota.limit,
            usedUnits,
            requestedUnits: quota.requestedUnits,
          });
        }
        const savedReservation = {
          ...reservation,
          jobId: job.id,
          reason: reservation.reason ?? null,
          committedAt: null,
          refundedAt: null,
          createdAt: new Date('2026-05-06T00:00:00Z'),
          updatedAt: new Date('2026-05-06T00:00:00Z'),
        } satisfies RemoverQuotaReservation;
        const savedJob = {
          providerTaskId: null,
          outputImageKey: null,
          thumbnailKey: null,
          errorCode: null,
          errorMessage: null,
          createdAt: new Date('2026-05-06T00:00:00Z'),
          updatedAt: new Date('2026-05-06T00:00:00Z'),
          deletedAt: null,
          ...job,
        } satisfies RemoverJob;
        reservations.push(savedReservation);
        jobs.push(savedJob);
        return { reservation: savedReservation, job: savedJob, reused: false };
      },
      findJobByQuotaReservationId: async (reservationId: string) =>
        jobs.find(
          (job) => job.quotaReservationId === reservationId && !job.deletedAt
        ),
      findJobById: async (id: string) => jobs.find((job) => job.id === id),
      createId: () => `id_${++idCounter}`,
      now: () => new Date('2026-05-06T12:00:00Z'),
    } satisfies Parameters<typeof createQueuedRemoverJob>[0]['deps'],
  };
}

test('createQueuedRemoverJob reserves quota and creates a queued job', async () => {
  const { deps, reservations } = createDeps();

  const result = await createQueuedRemoverJob({
    actor,
    inputImageAssetId: 'input_1',
    maskImageAssetId: 'mask_1',
    idempotencyKey: 'idem_job_1',
    providerConfig,
    deps,
  });

  assert.equal(result.reused, false);
  assert.equal(result.job.status, 'queued');
  assert.equal(
    result.job.inputImageKey,
    'remover/anonymous/anon_1/original/input_1.png'
  );
  assert.equal(reservations.length, 1);
  assert.equal(reservations[0]?.status, 'reserved');
  assert.equal(reservations[0]?.jobId, result.job.id);
  assert.equal(
    reservations[0]?.idempotencyKey,
    'processing:anonymous:anon_1:idem_job_1'
  );
});

test('createQueuedRemoverJob returns the existing job for the same idempotency key', async () => {
  const { deps } = createDeps();
  const first = await createQueuedRemoverJob({
    actor,
    inputImageAssetId: 'input_1',
    maskImageAssetId: 'mask_1',
    idempotencyKey: 'idem_job_1',
    providerConfig,
    deps,
  });

  const second = await createQueuedRemoverJob({
    actor,
    inputImageAssetId: 'input_1',
    maskImageAssetId: 'mask_1',
    idempotencyKey: 'idem_job_1',
    providerConfig,
    deps,
  });

  assert.equal(second.reused, true);
  assert.equal(second.job.id, first.job.id);
});

test('createQueuedRemoverJob scopes the same client idempotency key by owner', async () => {
  const { deps, reservations, jobs } = createDeps();
  reservations.push({
    id: 'reservation_other',
    userId: null,
    anonymousSessionId: 'anon_2',
    productId: 'guest',
    quotaType: 'processing',
    units: 1,
    status: 'reserved',
    idempotencyKey: 'processing:anonymous:anon_2:idem_job_1',
    jobId: 'job_other',
    reason: null,
    createdAt: new Date('2026-05-06T00:00:00Z'),
    updatedAt: new Date('2026-05-06T00:00:00Z'),
    committedAt: null,
    refundedAt: null,
    expiresAt: new Date('2026-05-07T00:00:00Z'),
  });
  jobs.push({
    id: 'job_other',
    userId: null,
    anonymousSessionId: 'anon_2',
    provider: 'replicate',
    model: 'test/remover',
    providerTaskId: null,
    status: 'queued',
    inputImageAssetId: 'input_other',
    maskImageAssetId: 'mask_other',
    inputImageKey: 'input-other.png',
    maskImageKey: 'mask-other.png',
    outputImageKey: null,
    thumbnailKey: null,
    costUnits: 1,
    quotaReservationId: 'reservation_other',
    errorCode: null,
    errorMessage: null,
    createdAt: new Date('2026-05-06T00:00:00Z'),
    updatedAt: new Date('2026-05-06T00:00:00Z'),
    deletedAt: null,
    expiresAt: new Date('2026-05-07T00:00:00Z'),
  });

  const result = await createQueuedRemoverJob({
    actor,
    inputImageAssetId: 'input_1',
    maskImageAssetId: 'mask_1',
    idempotencyKey: 'idem_job_1',
    providerConfig,
    deps,
  });

  assert.equal(result.reused, false);
  assert.equal(reservations.length, 2);
  assert.equal(
    reservations[1]?.idempotencyKey,
    'processing:anonymous:anon_1:idem_job_1'
  );
});

test('createQueuedRemoverJob rejects over-quota requests before creating records', async () => {
  const { deps, reservations, jobs } = createDeps({ usedUnits: 2 });

  await assert.rejects(
    () =>
      createQueuedRemoverJob({
        actor,
        inputImageAssetId: 'input_1',
        maskImageAssetId: 'mask_1',
        idempotencyKey: 'idem_job_1',
        providerConfig,
        deps,
      }),
    /remover quota exceeded/
  );

  assert.equal(reservations.length, 0);
  assert.equal(jobs.length, 0);
});

test('createQueuedRemoverJob delegates reservation and job creation atomically', async () => {
  let createdInput:
    | {
        reservationId: string;
        reservationJobId: string | null | undefined;
        jobId: string;
        jobReservationId: string;
        quotaUserId: string | null;
        quotaAnonymousSessionId: string | null;
        quotaType: string;
        quotaLimit: number;
        quotaRequestedUnits: number;
        quotaWindowStart: string;
      }
    | undefined;
  const { deps } = createDeps();

  await createQueuedRemoverJob({
    actor,
    inputImageAssetId: 'input_1',
    maskImageAssetId: 'mask_1',
    idempotencyKey: 'idem_atomic_1',
    providerConfig,
    deps: {
      ...deps,
      createJobWithReservation: async ({ reservation, job, quota }) => {
        createdInput = {
          reservationId: reservation.id,
          reservationJobId: reservation.jobId,
          jobId: job.id,
          jobReservationId: job.quotaReservationId,
          quotaUserId: quota.userId,
          quotaAnonymousSessionId: quota.anonymousSessionId,
          quotaType: quota.quotaType,
          quotaLimit: quota.limit,
          quotaRequestedUnits: quota.requestedUnits,
          quotaWindowStart: quota.windowStart.toISOString(),
        };
        return {
          reservation: {
            ...reservation,
            jobId: job.id,
            reason: null,
            committedAt: null,
            refundedAt: null,
            createdAt: new Date('2026-05-06T00:00:00Z'),
            updatedAt: new Date('2026-05-06T00:00:00Z'),
          },
          job: {
            providerTaskId: null,
            outputImageKey: null,
            thumbnailKey: null,
            errorCode: null,
            errorMessage: null,
            createdAt: new Date('2026-05-06T00:00:00Z'),
            updatedAt: new Date('2026-05-06T00:00:00Z'),
            deletedAt: null,
            ...job,
          },
          reused: false,
        };
      },
    },
  });

  assert.deepEqual(createdInput, {
    reservationId: 'id_1',
    reservationJobId: undefined,
    jobId: 'id_2',
    jobReservationId: 'id_1',
    quotaUserId: null,
    quotaAnonymousSessionId: 'anon_1',
    quotaType: 'processing',
    quotaLimit: 2,
    quotaRequestedUnits: 1,
    quotaWindowStart: '2026-05-06T00:00:00.000Z',
  });
});

test('createQueuedRemoverJob checks signed-in processing quota by user only', async () => {
  let quotaOwner:
    | { userId: string | null; anonymousSessionId: string | null }
    | undefined;
  const { deps } = createDeps();

  await createQueuedRemoverJob({
    actor: {
      kind: 'user',
      userId: 'user_1',
      anonymousSessionId: 'anon_2',
      productId: 'free',
    },
    inputImageAssetId: 'input_1',
    maskImageAssetId: 'mask_1',
    idempotencyKey: 'idem_job_user_1',
    providerConfig,
    deps: {
      ...deps,
      findAsset: async (id) => ({
        ...asset(id, id === 'mask_1' ? 'mask' : 'original'),
        userId: 'user_1',
        anonymousSessionId: null,
      }),
      createJobWithReservation: async ({ reservation, job, quota }) => {
        quotaOwner = {
          userId: quota.userId,
          anonymousSessionId: quota.anonymousSessionId,
        };
        return {
          reservation: {
            ...reservation,
            jobId: job.id,
            reason: null,
            committedAt: null,
            refundedAt: null,
            createdAt: new Date('2026-05-06T00:00:00Z'),
            updatedAt: new Date('2026-05-06T00:00:00Z'),
          },
          job: {
            providerTaskId: null,
            outputImageKey: null,
            thumbnailKey: null,
            errorCode: null,
            errorMessage: null,
            createdAt: new Date('2026-05-06T00:00:00Z'),
            updatedAt: new Date('2026-05-06T00:00:00Z'),
            deletedAt: null,
            ...job,
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

test('createQueuedRemoverJob scopes signed-in idempotency by user only', async () => {
  let reservationKey: string | undefined;
  const { deps } = createDeps();

  await createQueuedRemoverJob({
    actor: {
      kind: 'user',
      userId: 'user_1',
      anonymousSessionId: 'anon_2',
      productId: 'free',
    },
    inputImageAssetId: 'input_1',
    maskImageAssetId: 'mask_1',
    idempotencyKey: 'idem_job_user_1',
    providerConfig,
    deps: {
      ...deps,
      findAsset: async (id) => ({
        ...asset(id, id === 'mask_1' ? 'mask' : 'original'),
        userId: 'user_1',
        anonymousSessionId: null,
      }),
      createJobWithReservation: async ({ reservation, job }) => {
        reservationKey = reservation.idempotencyKey;
        return {
          reservation: {
            ...reservation,
            jobId: job.id,
            reason: null,
            committedAt: null,
            refundedAt: null,
            createdAt: new Date('2026-05-06T00:00:00Z'),
            updatedAt: new Date('2026-05-06T00:00:00Z'),
          },
          job: {
            providerTaskId: null,
            outputImageKey: null,
            thumbnailKey: null,
            errorCode: null,
            errorMessage: null,
            createdAt: new Date('2026-05-06T00:00:00Z'),
            updatedAt: new Date('2026-05-06T00:00:00Z'),
            deletedAt: null,
            ...job,
          },
          reused: false,
        };
      },
    },
  });

  assert.equal(reservationKey, 'processing:user:user_1:idem_job_user_1');
});

test('createQueuedRemoverJob returns atomic idempotency replay from job creation', async () => {
  const { deps } = createDeps();
  const existingJob = {
    id: 'job_existing',
    userId: null,
    anonymousSessionId: 'anon_1',
    provider: 'replicate',
    model: 'test/remover',
    providerTaskId: null,
    status: 'queued',
    inputImageAssetId: 'input_1',
    maskImageAssetId: 'mask_1',
    inputImageKey: 'input.png',
    maskImageKey: 'mask.png',
    outputImageKey: null,
    thumbnailKey: null,
    costUnits: 1,
    quotaReservationId: 'reservation_existing',
    errorCode: null,
    errorMessage: null,
    createdAt: new Date('2026-05-06T00:00:00Z'),
    updatedAt: new Date('2026-05-06T00:00:00Z'),
    deletedAt: null,
    expiresAt: new Date('2026-05-07T00:00:00Z'),
  } satisfies RemoverJob;

  const result = await createQueuedRemoverJob({
    actor,
    inputImageAssetId: 'input_1',
    maskImageAssetId: 'mask_1',
    idempotencyKey: 'idem_job_1',
    providerConfig,
    deps: {
      ...deps,
      createJobWithReservation: async ({ reservation }) => ({
        reservation: {
          ...reservation,
          id: 'reservation_existing',
          jobId: existingJob.id,
          reason: null,
          committedAt: null,
          refundedAt: null,
          createdAt: new Date('2026-05-06T00:00:00Z'),
          updatedAt: new Date('2026-05-06T00:00:00Z'),
        },
        job: existingJob,
        reused: true,
      }),
    },
  });

  assert.equal(result.reused, true);
  assert.equal(result.job.id, 'job_existing');
});

test('createQueuedRemoverJob rejects deleted idempotency replays', async () => {
  const { deps, reservations, jobs } = createDeps();
  reservations.push({
    id: 'reservation_deleted',
    userId: null,
    anonymousSessionId: 'anon_1',
    productId: 'guest',
    quotaType: 'processing',
    units: 1,
    status: 'reserved',
    idempotencyKey: 'processing:anonymous:anon_1:idem_deleted_1',
    jobId: 'job_deleted',
    reason: null,
    createdAt: new Date('2026-05-06T00:00:00Z'),
    updatedAt: new Date('2026-05-06T00:00:00Z'),
    committedAt: null,
    refundedAt: null,
    expiresAt: new Date('2026-05-07T00:00:00Z'),
  });
  jobs.push({
    id: 'job_deleted',
    userId: null,
    anonymousSessionId: 'anon_1',
    provider: 'replicate',
    model: 'test/remover',
    providerTaskId: null,
    status: 'queued',
    inputImageAssetId: 'input_1',
    maskImageAssetId: 'mask_1',
    inputImageKey: 'input.png',
    maskImageKey: 'mask.png',
    outputImageKey: null,
    thumbnailKey: null,
    costUnits: 1,
    quotaReservationId: 'reservation_deleted',
    errorCode: null,
    errorMessage: null,
    createdAt: new Date('2026-05-06T00:00:00Z'),
    updatedAt: new Date('2026-05-06T00:00:00Z'),
    deletedAt: new Date('2026-05-06T01:00:00Z'),
    expiresAt: new Date('2026-05-07T00:00:00Z'),
  });

  await assert.rejects(
    () =>
      createQueuedRemoverJob({
        actor,
        inputImageAssetId: 'input_1',
        maskImageAssetId: 'mask_1',
        idempotencyKey: 'idem_deleted_1',
        providerConfig,
        deps,
      }),
    /quota reservation already exists without a job/
  );
});

test('getRemoverJobForActor enforces owner access', async () => {
  const job = {
    id: 'job_1',
    userId: null,
    anonymousSessionId: 'anon_2',
  } as RemoverJob;

  await assert.rejects(
    () =>
      getRemoverJobForActor({
        actor,
        jobId: 'job_1',
        deps: {
          findJobById: async () => job,
        },
      }),
    /not accessible/
  );
});

test('getRemoverJobForActor allows a signed-in user to access the same anonymous session job', async () => {
  const job = {
    id: 'job_1',
    userId: null,
    anonymousSessionId: 'anon_1',
  } as RemoverJob;

  const result = await getRemoverJobForActor({
    actor: {
      kind: 'user',
      userId: 'user_1',
      anonymousSessionId: 'anon_1',
      productId: 'free',
    },
    jobId: 'job_1',
    deps: {
      findJobById: async () => job,
    },
  });

  assert.equal(result.id, 'job_1');
});

test('claimRemoverJobForActor attaches same-session guest job records to the signed-in user', async () => {
  const calls: string[] = [];
  const job = {
    id: 'job_1',
    userId: null,
    anonymousSessionId: 'anon_1',
    inputImageKey: 'input.png',
    maskImageKey: 'mask.png',
    outputImageKey: 'output.png',
    thumbnailKey: null,
    quotaReservationId: 'reservation_1',
  } as RemoverJob;

  const result = await claimRemoverJobForActor({
    actor: {
      kind: 'user',
      userId: 'user_1',
      anonymousSessionId: 'anon_1',
      productId: 'free',
    },
    job,
    deps: {
      claimJobById: async ({ userId }) => {
        calls.push(`job:${userId}`);
        return { ...job, userId };
      },
      claimAssetsByKeys: async ({ storageKeys, userId }) => {
        calls.push(`assets:${userId}:${storageKeys.join(',')}`);
      },
      claimReservationById: async ({ reservationId, userId }) => {
        calls.push(`reservation:${userId}:${reservationId}`);
      },
    },
  });

  assert.equal(result.userId, 'user_1');
  assert.deepEqual(calls, [
    'job:user_1',
    'assets:user_1:input.png,mask.png,output.png',
    'reservation:user_1:reservation_1',
  ]);
});

test('listMyRemoverJobsForActor claims same-session guest jobs before listing signed-in history', async () => {
  const calls: string[] = [];
  const guestJob = {
    id: 'guest_job_1',
    userId: null,
    anonymousSessionId: 'anon_1',
    inputImageKey: 'input.png',
    maskImageKey: 'mask.png',
    outputImageKey: 'output.png',
    thumbnailKey: 'thumbnail.webp',
    quotaReservationId: 'reservation_1',
  } as RemoverJob;
  const userJob = {
    ...guestJob,
    id: 'user_job_1',
    userId: 'user_1',
    anonymousSessionId: null,
  } as RemoverJob;

  const result = await listMyRemoverJobsForActor({
    actor: {
      kind: 'user',
      userId: 'user_1',
      anonymousSessionId: 'anon_1',
      productId: 'free',
    },
    limit: 30,
    deps: {
      listJobsForOwner: async (owner) => {
        calls.push(
          `list:${owner.userId ?? 'guest'}:${owner.anonymousSessionId ?? 'none'}`
        );
        return owner.userId ? [userJob] : [guestJob];
      },
      claimJobById: async ({ id, userId }) => {
        calls.push(`claim-job:${id}:${userId}`);
        return { ...guestJob, userId };
      },
      claimAssetsByKeys: async ({ userId, storageKeys }) => {
        calls.push(`claim-assets:${userId}:${storageKeys.join(',')}`);
      },
      claimReservationById: async ({ userId, reservationId }) => {
        calls.push(`claim-reservation:${userId}:${reservationId}`);
      },
    },
  });

  assert.deepEqual(result, [userJob]);
  assert.deepEqual(calls, [
    'list:guest:anon_1',
    'claim-job:guest_job_1:user_1',
    'claim-assets:user_1:input.png,mask.png,output.png,thumbnail.webp',
    'claim-reservation:user_1:reservation_1',
    'list:user_1:none',
  ]);
});
