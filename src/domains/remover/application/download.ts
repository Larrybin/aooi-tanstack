import {
  ForbiddenError,
  NotFoundError,
  TooManyRequestsError,
} from '@/shared/lib/api/errors';
import { getUuid } from '@/shared/lib/hash';

import { assertActorOwnsResource, getRemoverOwner } from '../domain/actor';
import { formatRemoverEntitlementGrantIdsJson } from '../domain/entitlement-grants';
import { addRetentionDays, resolveRemoverPlanLimits } from '../domain/plan';
import {
  getQuotaWindowStart,
  isQuotaReservationReusable,
  REMOVER_QUOTA_OPERATION_KEYS,
} from '../domain/quota';
import type { RemoverActor } from '../domain/types';
import type { RemoverJob } from '../infra/job';
import type {
  RemoverQuotaReservation,
  ReserveRemoverQuotaInput,
} from '../infra/quota-reservation';

type DownloadVariant = 'low_res' | 'high_res';

type DownloadDeps = {
  findJobById: (id: string) => Promise<RemoverJob | undefined>;
  findReservationByIdempotencyKey: (
    key: string
  ) => Promise<RemoverQuotaReservation | undefined>;
  reserveQuota: (
    input: ReserveRemoverQuotaInput
  ) => Promise<{ reservation: RemoverQuotaReservation; reused: boolean }>;
  commitReservation: (input: {
    reservationId: string;
    now?: Date;
  }) => Promise<unknown>;
  createId?: () => string;
  now?: () => Date;
};

function assertDownloadableJob({
  actor,
  job,
}: {
  actor: RemoverActor;
  job: RemoverJob | undefined;
}) {
  if (!job || job.deletedAt) {
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

  if (job.status !== 'succeeded' || !job.outputImageKey) {
    throw new NotFoundError('remover output image not found');
  }

  return job;
}

function resolveDownloadKey(job: RemoverJob, variant: DownloadVariant): string {
  if (variant === 'low_res') {
    return job.thumbnailKey || '';
  }

  return job.outputImageKey || '';
}

export async function reserveHighResDownloadQuota({
  actor,
  job,
  deps,
}: {
  actor: Extract<RemoverActor, { kind: 'user' }>;
  job: RemoverJob;
  deps: DownloadDeps;
}): Promise<string> {
  const plan = resolveRemoverPlanLimits(actor);
  if (plan.highResDownloads <= 0) {
    throw new TooManyRequestsError('high-res download quota exceeded', {
      limit: plan.highResDownloads,
      usedUnits: 0,
      requestedUnits: 1,
    });
  }

  const now = (deps.now ?? (() => new Date()))();
  const idempotencyKey = `high-res-download:${actor.userId}:${job.id}`;
  const existingReservation =
    await deps.findReservationByIdempotencyKey(idempotencyKey);
  if (existingReservation) {
    if (existingReservation.userId !== actor.userId) {
      throw new ForbiddenError('download reservation is not accessible');
    }
    if (
      isQuotaReservationReusable({
        status: existingReservation.status,
        expiresAt: existingReservation.expiresAt,
        now,
      })
    ) {
      return existingReservation.id;
    }
  }

  const owner = getRemoverOwner(actor);
  const windowStart =
    plan.highResDownloadWindow === 'lifetime'
      ? new Date(0)
      : getQuotaWindowStart(now, plan.highResDownloadWindow);

  const { reservation } = await deps.reserveQuota({
    actor,
    productId: plan.productId,
    operationKey: REMOVER_QUOTA_OPERATION_KEYS.imageHdDownload,
    units: 1,
    limit: plan.highResDownloads,
    windowStart,
    idempotencyKey,
    jobId: job.id,
    entitlementGrantIdsJson: formatRemoverEntitlementGrantIdsJson(actor),
    expiresAt: addRetentionDays(now, 1),
    now,
    createId: deps.createId ?? getUuid,
  });
  return reservation.id;
}

export async function resolveRemoverDownload({
  actor,
  jobId,
  variant,
  deps,
}: {
  actor: RemoverActor;
  jobId: string;
  variant: DownloadVariant;
  deps: DownloadDeps;
}) {
  const job = assertDownloadableJob({
    actor,
    job: await deps.findJobById(jobId),
  });

  if (variant === 'high_res') {
    if (actor.kind !== 'user') {
      throw new ForbiddenError('sign in to download high-res results');
    }
    const storageKey = resolveDownloadKey(job, variant);
    if (!storageKey) {
      throw new NotFoundError('remover output image not found');
    }

    return {
      job,
      storageKey,
      quotaReservationIdToCommit: undefined,
      requiresHighResQuota: true,
      filename: `ai-remover-${job.id}-high-res.png`,
    };
  }

  const storageKey = resolveDownloadKey(job, variant);
  if (!storageKey) {
    throw new NotFoundError('remover output image not found');
  }

  return {
    job,
    storageKey,
    quotaReservationIdToCommit: undefined,
    requiresHighResQuota: false,
    filename: `ai-remover-${job.id}-low-res.png`,
  };
}
