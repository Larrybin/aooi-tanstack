import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '@/shared/lib/api/errors';
import { getUuid } from '@/shared/lib/hash';

import { assertActorOwnsResource, getRemoverOwner } from '../domain/actor';
import { addRetentionDays, resolveRemoverPlanLimits } from '../domain/plan';
import { getQuotaWindowStart } from '../domain/quota';
import type {
  RemoverActor,
  RemoverJobStatus,
  RemoverQuotaType,
} from '../domain/types';
import type { RemoverImageAsset } from '../infra/image-asset';
import type { NewRemoverJob, RemoverJob } from '../infra/job';
import type {
  NewRemoverQuotaReservation,
  RemoverQuotaReservation,
} from '../infra/quota-reservation';

type JobDeps = {
  findAsset: (id: string) => Promise<RemoverImageAsset | undefined>;
  findReservationByIdempotencyKey: (
    key: string
  ) => Promise<RemoverQuotaReservation | undefined>;
  createJobWithReservation: (input: {
    reservation: NewRemoverQuotaReservation;
    job: NewRemoverJob;
    quota: {
      userId: string | null;
      anonymousSessionId: string | null;
      quotaType: RemoverQuotaType;
      windowStart: Date;
      limit: number;
      requestedUnits: number;
      now?: Date;
    };
  }) => Promise<{
    reservation: RemoverQuotaReservation;
    job: RemoverJob;
    reused: boolean;
  }>;
  findJobByQuotaReservationId: (
    quotaReservationId: string
  ) => Promise<RemoverJob | undefined>;
  findJobById: (id: string) => Promise<RemoverJob | undefined>;
  claimJobById?: (input: {
    id: string;
    userId: string;
    anonymousSessionId: string;
  }) => Promise<RemoverJob | undefined>;
  claimAssetsByKeys?: (input: {
    storageKeys: string[];
    userId: string;
    anonymousSessionId: string;
  }) => Promise<unknown>;
  claimReservationById?: (input: {
    reservationId: string;
    userId: string;
    anonymousSessionId: string;
  }) => Promise<unknown>;
  createId?: () => string;
  now?: () => Date;
};

type MyImagesDeps = Required<
  Pick<JobDeps, 'claimJobById' | 'claimAssetsByKeys' | 'claimReservationById'>
> & {
  listJobsForOwner: (input: {
    userId: string | null;
    anonymousSessionId: string | null;
    limit?: number;
  }) => Promise<RemoverJob[]>;
};

function assertAssetUsable({
  actor,
  asset,
  expectedKind,
}: {
  actor: RemoverActor;
  asset: RemoverImageAsset | undefined;
  expectedKind: 'original' | 'mask';
}): RemoverImageAsset {
  if (!asset) {
    throw new NotFoundError('remover image asset not found');
  }

  if (asset.kind !== expectedKind) {
    throw new BadRequestError(`expected ${expectedKind} image asset`);
  }

  if (
    !assertActorOwnsResource(actor, {
      userId: asset.userId,
      anonymousSessionId: asset.anonymousSessionId,
    })
  ) {
    throw new ForbiddenError('remover image asset is not accessible');
  }

  return asset;
}

function assertExistingJobAccessible({
  actor,
  job,
}: {
  actor: RemoverActor;
  job: RemoverJob;
}) {
  if (
    !assertActorOwnsResource(actor, {
      userId: job.userId,
      anonymousSessionId: job.anonymousSessionId,
    })
  ) {
    throw new ForbiddenError('remover job is not accessible');
  }
}

function buildProcessingReservationIdempotencyKey({
  owner,
  idempotencyKey,
}: {
  owner: { userId: string | null; anonymousSessionId: string | null };
  idempotencyKey: string;
}) {
  const ownerKey = owner.userId
    ? `user:${owner.userId}`
    : `anonymous:${owner.anonymousSessionId ?? 'none'}`;
  return `processing:${ownerKey}:${idempotencyKey}`;
}

export async function createQueuedRemoverJob({
  actor,
  inputImageAssetId,
  maskImageAssetId,
  idempotencyKey,
  providerConfig,
  deps,
}: {
  actor: RemoverActor;
  inputImageAssetId: string;
  maskImageAssetId: string;
  idempotencyKey: string;
  providerConfig: {
    provider: string;
    model: string;
  };
  deps: JobDeps;
}) {
  const owner = getRemoverOwner(actor);
  const scopedIdempotencyKey = buildProcessingReservationIdempotencyKey({
    owner,
    idempotencyKey,
  });
  const existingReservation =
    await deps.findReservationByIdempotencyKey(scopedIdempotencyKey);
  if (existingReservation) {
    const existingJob = await deps.findJobByQuotaReservationId(
      existingReservation.id
    );
    if (existingJob) {
      assertExistingJobAccessible({ actor, job: existingJob });
      return { job: existingJob, reused: true };
    }
    throw new ConflictError('quota reservation already exists without a job');
  }

  const [inputAsset, maskAsset] = await Promise.all([
    deps.findAsset(inputImageAssetId),
    deps.findAsset(maskImageAssetId),
  ]);
  const usableInputAsset = assertAssetUsable({
    actor,
    asset: inputAsset,
    expectedKind: 'original',
  });
  const usableMaskAsset = assertAssetUsable({
    actor,
    asset: maskAsset,
    expectedKind: 'mask',
  });

  const now = (deps.now ?? (() => new Date()))();
  const plan = resolveRemoverPlanLimits(actor);
  const quotaType: RemoverQuotaType = 'processing';
  const windowStart = getQuotaWindowStart(now, plan.processingWindow);

  const reservation: NewRemoverQuotaReservation = {
    id: (deps.createId ?? getUuid)(),
    ...owner,
    productId: plan.productId,
    quotaType,
    units: 1,
    status: 'reserved',
    idempotencyKey: scopedIdempotencyKey,
    expiresAt: addRetentionDays(now, 1),
  };

  const jobStatus: RemoverJobStatus = 'queued';
  const jobId = (deps.createId ?? getUuid)();
  const created = await deps.createJobWithReservation({
    reservation,
    job: {
      id: jobId,
      ...owner,
      ...providerConfig,
      status: jobStatus,
      inputImageAssetId: usableInputAsset.id,
      maskImageAssetId: usableMaskAsset.id,
      inputImageKey: usableInputAsset.storageKey,
      maskImageKey: usableMaskAsset.storageKey,
      costUnits: 1,
      quotaReservationId: reservation.id,
      expiresAt: addRetentionDays(now, plan.retentionDays),
    },
    quota: {
      ...owner,
      quotaType,
      windowStart,
      limit: plan.processingLimit,
      requestedUnits: 1,
      now,
    },
  });
  assertExistingJobAccessible({ actor, job: created.job });

  return { job: created.job, reused: created.reused };
}

export async function getRemoverJobForActor({
  actor,
  jobId,
  deps,
}: {
  actor: RemoverActor;
  jobId: string;
  deps: Pick<JobDeps, 'findJobById'>;
}) {
  const job = await deps.findJobById(jobId);
  if (!job) {
    throw new NotFoundError('remover job not found');
  }
  if (job.deletedAt) {
    throw new NotFoundError('remover job not found');
  }

  if (
    !assertActorOwnsResource(actor, {
      userId: job.userId,
      anonymousSessionId: job.anonymousSessionId,
    })
  ) {
    throw new ForbiddenError('remover job is not accessible');
  }

  return job;
}

export async function claimRemoverJobForActor({
  actor,
  job,
  deps,
}: {
  actor: RemoverActor;
  job: RemoverJob;
  deps: Required<
    Pick<JobDeps, 'claimJobById' | 'claimAssetsByKeys' | 'claimReservationById'>
  >;
}) {
  if (
    actor.kind !== 'user' ||
    job.userId ||
    !job.anonymousSessionId ||
    actor.anonymousSessionId !== job.anonymousSessionId
  ) {
    return job;
  }

  const claimedJob = await deps.claimJobById({
    id: job.id,
    userId: actor.userId,
    anonymousSessionId: job.anonymousSessionId,
  });
  const nextJob = claimedJob ?? job;

  await Promise.all([
    deps.claimAssetsByKeys({
      userId: actor.userId,
      anonymousSessionId: job.anonymousSessionId,
      storageKeys: [
        job.inputImageKey,
        job.maskImageKey,
        job.outputImageKey || '',
        job.thumbnailKey || '',
      ].filter(Boolean),
    }),
    deps.claimReservationById({
      reservationId: job.quotaReservationId,
      userId: actor.userId,
      anonymousSessionId: job.anonymousSessionId,
    }),
  ]);

  return nextJob;
}

export async function listMyRemoverJobsForActor({
  actor,
  limit = 30,
  deps,
}: {
  actor: RemoverActor;
  limit?: number;
  deps: MyImagesDeps;
}) {
  if (actor.kind !== 'user') {
    return [];
  }

  if (actor.anonymousSessionId) {
    const guestJobs = await deps.listJobsForOwner({
      userId: null,
      anonymousSessionId: actor.anonymousSessionId,
      limit,
    });
    await Promise.all(
      guestJobs.map((job) =>
        claimRemoverJobForActor({
          actor,
          job,
          deps,
        })
      )
    );
  }

  return deps.listJobsForOwner({
    userId: actor.userId,
    anonymousSessionId: null,
    limit,
  });
}
