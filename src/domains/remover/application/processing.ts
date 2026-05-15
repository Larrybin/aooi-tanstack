import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UpstreamError,
} from '@/shared/lib/api/errors';

import { assertActorOwnsResource } from '../domain/actor';
import type { RemoverActor, RemoverJobStatus } from '../domain/types';
import type { RemoverImageAsset } from '../infra/image-asset';
import type { RemoverJob, UpdateRemoverJob } from '../infra/job';
import type {
  RemoverProviderAdapter,
  RemoverProviderTaskResult,
} from './provider';

type SubmitDeps = {
  findJobById: (id: string) => Promise<RemoverJob | undefined>;
  findAsset: (id: string) => Promise<RemoverImageAsset | undefined>;
  updateJob: (id: string, update: UpdateRemoverJob) => Promise<RemoverJob>;
  claimJobForProviderSubmission: (input: {
    id: string;
    staleBefore: Date;
  }) => Promise<RemoverJob | undefined>;
  commitReservation: (input: {
    reservationId: string;
    now?: Date;
  }) => Promise<unknown>;
  refundReservation: (input: {
    reservationId: string;
    reason?: string;
    now?: Date;
  }) => Promise<unknown>;
  storeOutputImage: (input: {
    job: RemoverJob;
    outputImageUrl: string;
  }) => Promise<{ outputStorageKey: string; thumbnailStorageKey: string }>;
  withOutputStorageLock?: <T>(
    jobId: string,
    callback: () => Promise<T>
  ) => Promise<T>;
  providerAdapter: RemoverProviderAdapter;
  now?: () => Date;
};

const PROVIDER_SUBMISSION_LEASE_MS = 2 * 60 * 1000;

type RefreshDeps = {
  findJobById: (id: string) => Promise<RemoverJob | undefined>;
  updateJob: (id: string, update: UpdateRemoverJob) => Promise<RemoverJob>;
  commitReservation: (input: {
    reservationId: string;
    now?: Date;
  }) => Promise<unknown>;
  refundReservation: (input: {
    reservationId: string;
    reason?: string;
    now?: Date;
  }) => Promise<unknown>;
  storeOutputImage: (input: {
    job: RemoverJob;
    outputImageUrl: string;
  }) => Promise<{ outputStorageKey: string; thumbnailStorageKey: string }>;
  withOutputStorageLock?: <T>(
    jobId: string,
    callback: () => Promise<T>
  ) => Promise<T>;
  providerAdapter: Pick<RemoverProviderAdapter, 'getTaskStatus'>;
  now?: () => Date;
};

function assertJobAccessible({
  actor,
  job,
}: {
  actor: RemoverActor;
  job: RemoverJob | undefined;
}): RemoverJob {
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

function isTerminal(status: string): boolean {
  return status === 'succeeded' || status === 'failed';
}

function mapProviderUpdate(
  result: RemoverProviderTaskResult
): UpdateRemoverJob {
  return {
    providerTaskId: result.providerTaskId,
    status: result.status,
    errorCode: result.errorCode ?? null,
    errorMessage: result.errorMessage ?? null,
  };
}

function withOutputStorageLock<T>(
  deps: Pick<SubmitDeps | RefreshDeps, 'withOutputStorageLock'>,
  jobId: string,
  callback: () => Promise<T>
) {
  return deps.withOutputStorageLock
    ? deps.withOutputStorageLock(jobId, callback)
    : callback();
}

async function failJobAndRefund({
  job,
  reason,
  deps,
}: {
  job: RemoverJob;
  reason: string;
  deps: Pick<
    SubmitDeps | RefreshDeps,
    'updateJob' | 'refundReservation' | 'now'
  >;
}) {
  const failed = await deps.updateJob(job.id, {
    status: 'failed',
    errorCode: 'provider_error',
    errorMessage: reason,
  });
  await deps.refundReservation({
    reservationId: job.quotaReservationId,
    reason,
    now: deps.now?.(),
  });
  return failed;
}

export async function submitRemoverJobToProvider({
  actor,
  jobId,
  deps,
}: {
  actor: RemoverActor;
  jobId: string;
  deps: SubmitDeps;
}) {
  const job = assertJobAccessible({
    actor,
    job: await deps.findJobById(jobId),
  });

  if (isTerminal(job.status) || job.providerTaskId) {
    return job;
  }

  if (job.status !== 'queued' && job.status !== 'processing') {
    throw new ConflictError('only queued remover jobs can be submitted');
  }

  const now = deps.now?.() ?? new Date();
  const claimedJob = await deps.claimJobForProviderSubmission({
    id: job.id,
    staleBefore: new Date(now.getTime() - PROVIDER_SUBMISSION_LEASE_MS),
  });
  if (!claimedJob) {
    return (await deps.findJobById(job.id)) ?? job;
  }

  const [inputAsset, maskAsset] = await Promise.all([
    deps.findAsset(claimedJob.inputImageAssetId),
    deps.findAsset(claimedJob.maskImageAssetId),
  ]);
  if (!inputAsset || !maskAsset) {
    return failJobAndRefund({
      job: claimedJob,
      reason: 'remover job input image is missing',
      deps,
    });
  }

  try {
    const result = await deps.providerAdapter.submitTask({
      inputImageUrl: inputAsset.url,
      maskImageUrl: maskAsset.url,
    });
    const submitted = await deps.updateJob(claimedJob.id, {
      ...mapProviderUpdate(result),
      provider: deps.providerAdapter.config.provider,
      model: deps.providerAdapter.config.model,
      status: result.status === 'queued' ? 'processing' : result.status,
    });

    if (result.status === 'succeeded') {
      return refreshSucceededJob({
        job: submitted,
        result,
        deps,
      });
    }

    if (result.status === 'failed') {
      await deps.refundReservation({
        reservationId: claimedJob.quotaReservationId,
        reason: result.errorMessage ?? 'provider failed',
        now: deps.now?.(),
      });
    }

    return submitted;
  } catch (error: unknown) {
    return failJobAndRefund({
      job: claimedJob,
      reason: error instanceof Error ? error.message : 'provider submit failed',
      deps,
    });
  }
}

async function refreshSucceededJob({
  job,
  result,
  deps,
}: {
  job: RemoverJob;
  result: RemoverProviderTaskResult;
  deps: Pick<
    RefreshDeps,
    | 'storeOutputImage'
    | 'findJobById'
    | 'updateJob'
    | 'commitReservation'
    | 'refundReservation'
    | 'withOutputStorageLock'
    | 'now'
  >;
}) {
  if (!result.outputImageUrl) {
    return failJobAndRefund({
      job,
      reason: 'provider succeeded without an output image',
      deps,
    });
  }
  const outputImageUrl = result.outputImageUrl;

  return withOutputStorageLock(deps, job.id, async () => {
    const currentJob = (await deps.findJobById(job.id)) ?? job;
    if (currentJob.status === 'failed') {
      return currentJob;
    }
    if (
      currentJob.status === 'succeeded' &&
      currentJob.outputImageKey &&
      currentJob.thumbnailKey
    ) {
      return currentJob;
    }

    try {
      const output = await deps.storeOutputImage({
        job: currentJob,
        outputImageUrl,
      });
      const succeeded = await deps.updateJob(currentJob.id, {
        status: 'succeeded',
        outputImageKey: output.outputStorageKey,
        thumbnailKey: output.thumbnailStorageKey,
        errorCode: null,
        errorMessage: null,
      });
      await deps.commitReservation({
        reservationId: currentJob.quotaReservationId,
        now: deps.now?.(),
      });
      return succeeded;
    } catch (error: unknown) {
      return failJobAndRefund({
        job: currentJob,
        reason:
          error instanceof Error ? error.message : 'output storage failed',
        deps,
      });
    }
  });
}

export async function refreshRemoverJobStatus({
  actor,
  jobId,
  deps,
}: {
  actor: RemoverActor;
  jobId: string;
  deps: RefreshDeps;
}) {
  const job = assertJobAccessible({
    actor,
    job: await deps.findJobById(jobId),
  });

  if (isTerminal(job.status)) {
    return job;
  }

  if (!job.providerTaskId) {
    return job;
  }

  let result: RemoverProviderTaskResult;
  try {
    result = await deps.providerAdapter.getTaskStatus({
      providerTaskId: job.providerTaskId,
    });
  } catch (error: unknown) {
    throw new UpstreamError(
      502,
      error instanceof Error ? error.message : 'provider status query failed'
    );
  }

  const status = result.status satisfies RemoverJobStatus;
  if (status === 'succeeded') {
    return refreshSucceededJob({ job, result, deps });
  }

  if (status === 'failed') {
    return failJobAndRefund({
      job,
      reason: result.errorMessage ?? 'provider failed',
      deps,
    });
  }

  return deps.updateJob(job.id, mapProviderUpdate(result));
}
