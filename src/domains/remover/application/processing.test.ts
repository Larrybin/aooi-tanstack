import assert from 'node:assert/strict';
import test from 'node:test';

import type { RemoverActor } from '../domain/types';
import type { RemoverImageAsset } from '../infra/image-asset';
import type { RemoverJob, UpdateRemoverJob } from '../infra/job';
import {
  refreshRemoverJobStatus,
  submitRemoverJobToProvider,
} from './processing';

const actor = {
  kind: 'anonymous',
  anonymousSessionId: 'anon_1',
} satisfies RemoverActor;

function createJob(overrides: Partial<RemoverJob> = {}): RemoverJob {
  return {
    id: 'job_1',
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

function createAsset(id: string): RemoverImageAsset {
  return {
    id,
    userId: null,
    anonymousSessionId: 'anon_1',
    kind: id === 'mask_1' ? 'mask' : 'original',
    storageKey: `${id}.png`,
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

function createDeps(job: RemoverJob) {
  const updates: UpdateRemoverJob[] = [];
  let committed = false;
  let refundedReason: string | undefined;
  let outputStoreCalls = 0;

  const deps = {
    findJobById: async () => job,
    findAsset: async (id: string) => createAsset(id),
    updateJob: async (_id: string, update: UpdateRemoverJob) => {
      updates.push(update);
      Object.assign(job, update);
      return job;
    },
    claimJobForProviderSubmission: async () => {
      if (job.status !== 'queued' || job.providerTaskId) {
        return undefined;
      }
      job.status = 'processing';
      return job;
    },
    commitReservation: async () => {
      committed = true;
    },
    refundReservation: async ({ reason }: { reason?: string }) => {
      refundedReason = reason;
    },
    storeOutputImage: async () => {
      outputStoreCalls += 1;
      return {
        outputStorageKey: 'output.png',
        thumbnailStorageKey: 'thumbnail.webp',
      };
    },
    providerAdapter: {
      config: {
        provider: 'replicate',
        model: 'test/remover',
      },
      submitTask: async () => ({
        providerTaskId: 'provider_task_1',
        status: 'processing' as const,
      }),
      getTaskStatus: async () => ({
        providerTaskId: 'provider_task_1',
        status: 'processing' as const,
      }),
    },
    now: () => new Date('2026-05-06T12:00:00Z'),
  };

  return {
    deps,
    updates,
    get committed() {
      return committed;
    },
    get refundedReason() {
      return refundedReason;
    },
    get outputStoreCalls() {
      return outputStoreCalls;
    },
  };
}

test('submitRemoverJobToProvider sends input and mask URLs and stores provider task id', async () => {
  const job = createJob();
  const state = createDeps(job);

  const result = await submitRemoverJobToProvider({
    actor,
    jobId: job.id,
    deps: state.deps,
  });

  assert.equal(result.status, 'processing');
  assert.equal(result.providerTaskId, 'provider_task_1');
  assert.equal(state.committed, false);
  assert.equal(state.refundedReason, undefined);
});

test('submitRemoverJobToProvider stores output when provider succeeds during submit', async () => {
  const job = createJob();
  const state = createDeps(job);
  state.deps.providerAdapter.submitTask = async () => ({
    providerTaskId: 'provider_task_1',
    status: 'succeeded',
    outputImageUrl: 'https://provider.example.com/output.png',
  });

  const result = await submitRemoverJobToProvider({
    actor,
    jobId: job.id,
    deps: state.deps,
  });

  assert.equal(result.status, 'succeeded');
  assert.equal(result.outputImageKey, 'output.png');
  assert.equal(result.thumbnailKey, 'thumbnail.webp');
  assert.equal(state.outputStoreCalls, 1);
  assert.equal(state.committed, true);
  assert.equal(state.refundedReason, undefined);
});

test('submitRemoverJobToProvider does not submit when another request claimed the job', async () => {
  const job = createJob();
  const state = createDeps(job);
  let submitted = false;
  state.deps.claimJobForProviderSubmission = async () => undefined;
  state.deps.findJobById = async () => ({
    ...job,
    status: 'processing',
  });
  state.deps.providerAdapter.submitTask = async () => {
    submitted = true;
    return {
      providerTaskId: 'provider_task_1',
      status: 'processing',
    };
  };

  const result = await submitRemoverJobToProvider({
    actor,
    jobId: job.id,
    deps: state.deps,
  });

  assert.equal(result.status, 'processing');
  assert.equal(submitted, false);
});

test('submitRemoverJobToProvider can recover a stale processing job without provider task id', async () => {
  const job = createJob({
    status: 'processing',
    updatedAt: new Date('2026-05-06T11:55:00Z'),
  });
  const state = createDeps(job);
  let submitted = false;
  state.deps.claimJobForProviderSubmission = async ({ staleBefore }) => {
    if (
      job.status !== 'processing' ||
      job.providerTaskId ||
      job.updatedAt > staleBefore
    ) {
      return undefined;
    }
    return job;
  };
  state.deps.providerAdapter.submitTask = async () => {
    submitted = true;
    return {
      providerTaskId: 'provider_task_1',
      status: 'processing',
    };
  };

  const result = await submitRemoverJobToProvider({
    actor,
    jobId: job.id,
    deps: state.deps,
  });

  assert.equal(submitted, true);
  assert.equal(result.providerTaskId, 'provider_task_1');
});

test('refreshRemoverJobStatus commits quota and stores output on success', async () => {
  const job = createJob({
    status: 'processing',
    providerTaskId: 'provider_task_1',
  });
  const state = createDeps(job);
  state.deps.providerAdapter.getTaskStatus = async () => ({
    providerTaskId: 'provider_task_1',
    status: 'succeeded',
    outputImageUrl: 'https://provider.example.com/output.png',
  });

  const result = await refreshRemoverJobStatus({
    actor,
    jobId: job.id,
    deps: state.deps,
  });

  assert.equal(result.status, 'succeeded');
  assert.equal(result.outputImageKey, 'output.png');
  assert.equal(result.thumbnailKey, 'thumbnail.webp');
  assert.notEqual(result.outputImageKey, result.thumbnailKey);
  assert.equal(state.committed, true);
  assert.equal(state.refundedReason, undefined);
});

test('refreshRemoverJobStatus stores successful output only once after a locked reread', async () => {
  const job = createJob({
    status: 'processing',
    providerTaskId: 'provider_task_1',
  });
  const state = createDeps(job);
  let findCalls = 0;
  state.deps.findJobById = async () => {
    findCalls += 1;
    if (findCalls === 1 || findCalls === 3) {
      return {
        ...job,
        status: 'processing',
        outputImageKey: null,
        thumbnailKey: null,
      };
    }
    return job;
  };
  state.deps.withOutputStorageLock = async (_jobId, callback) => callback();
  state.deps.providerAdapter.getTaskStatus = async () => ({
    providerTaskId: 'provider_task_1',
    status: 'succeeded',
    outputImageUrl: 'https://provider.example.com/output.png',
  });

  const first = await refreshRemoverJobStatus({
    actor,
    jobId: job.id,
    deps: state.deps,
  });
  const second = await refreshRemoverJobStatus({
    actor,
    jobId: job.id,
    deps: state.deps,
  });

  assert.equal(first.status, 'succeeded');
  assert.equal(second.status, 'succeeded');
  assert.equal(state.outputStoreCalls, 1);
});

test('refreshRemoverJobStatus refunds quota on provider failure', async () => {
  const job = createJob({
    status: 'processing',
    providerTaskId: 'provider_task_1',
  });
  const state = createDeps(job);
  state.deps.providerAdapter.getTaskStatus = async () => ({
    providerTaskId: 'provider_task_1',
    status: 'failed',
    errorMessage: 'provider failed',
  });

  const result = await refreshRemoverJobStatus({
    actor,
    jobId: job.id,
    deps: state.deps,
  });

  assert.equal(result.status, 'failed');
  assert.equal(state.committed, false);
  assert.equal(state.refundedReason, 'provider failed');
});

test('refreshRemoverJobStatus leaves queued jobs without provider task id unchanged', async () => {
  const job = createJob();
  const state = createDeps(job);

  const result = await refreshRemoverJobStatus({
    actor,
    jobId: job.id,
    deps: state.deps,
  });

  assert.equal(result.status, 'queued');
  assert.equal(state.updates.length, 0);
});
