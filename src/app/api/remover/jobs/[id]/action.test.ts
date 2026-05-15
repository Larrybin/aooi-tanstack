import assert from 'node:assert/strict';
import test from 'node:test';

import type { RemoverActor } from '@/domains/remover/domain/types';
import type { RemoverJob } from '@/domains/remover/infra/job';

import { createRemoverJobGetAction } from './action';

const actor = {
  kind: 'user',
  userId: 'user_1',
} satisfies RemoverActor;

const job = {
  id: 'job_1',
  userId: 'user_1',
  anonymousSessionId: null,
  provider: 'cloudflare-workers-ai',
  model: '@cf/model',
  providerTaskId: 'task_1',
  status: 'succeeded',
  inputImageAssetId: 'input_asset',
  maskImageAssetId: 'mask_asset',
  inputImageKey: 'input.png',
  maskImageKey: 'mask.png',
  outputImageKey: 'output.png',
  thumbnailKey: 'thumbnail.webp',
  costUnits: 1,
  quotaReservationId: 'reservation_1',
  errorCode: null,
  errorMessage: null,
  createdAt: new Date('2026-05-06T00:00:00Z'),
  updatedAt: new Date('2026-05-06T00:00:00Z'),
  deletedAt: null,
  expiresAt: new Date('2026-05-07T00:00:00Z'),
} satisfies RemoverJob;

test('job status action does not expose high-res URL or storage keys', async () => {
  const action = createRemoverJobGetAction({
    createApiContext: () =>
      ({
        parseParams: async () => ({ id: 'job_1' }),
      }) as never,
    resolveActor: async () => actor,
    getRemoverJobForActor: async () => job,
    claimRemoverJobForActor: async () => job,
    refreshRemoverJobStatus: async () => job,
    submitRemoverJobToProvider: async () => job,
    resolveProviderAdapter: async () => {
      throw new Error('provider should not be resolved for terminal jobs');
    },
    jobDeps: {} as never,
    claimDeps: {} as never,
    refreshDeps: {} as never,
    submitDeps: {} as never,
  });

  const response = await action(
    new Request('https://example.com/api/remover/jobs/job_1'),
    { params: Promise.resolve({ id: 'job_1' }) }
  );
  const body = (await response.json()) as {
    data: { job: Record<string, unknown> };
  };

  assert.equal(body.data.job.outputImageUrl, undefined);
  assert.equal(body.data.job.outputImageKey, undefined);
  assert.equal(body.data.job.thumbnailKey, undefined);
  assert.equal(body.data.job.inputImageKey, undefined);
  assert.equal(body.data.job.maskImageKey, undefined);
  assert.equal(body.data.job.lowResDownloadAvailable, true);
});

test('job status action submits processing jobs without provider task ids', async () => {
  const processingJob = {
    ...job,
    providerTaskId: null,
    status: 'processing',
    outputImageKey: null,
    thumbnailKey: null,
  } satisfies RemoverJob;
  let submittedJobId = '';
  const action = createRemoverJobGetAction({
    createApiContext: () =>
      ({
        parseParams: async () => ({ id: 'job_1' }),
      }) as never,
    resolveActor: async () => actor,
    getRemoverJobForActor: async () => processingJob,
    claimRemoverJobForActor: async () => processingJob,
    refreshRemoverJobStatus: async () => {
      throw new Error('status query should not run without provider task id');
    },
    submitRemoverJobToProvider: async ({ jobId }) => {
      submittedJobId = jobId;
      return {
        ...processingJob,
        providerTaskId: 'task_2',
      };
    },
    resolveProviderAdapter: async () =>
      ({
        config: {
          provider: 'cloudflare-workers-ai',
          model: '@cf/model',
        },
      }) as never,
    jobDeps: {} as never,
    claimDeps: {} as never,
    refreshDeps: {} as never,
    submitDeps: {} as never,
  });

  const response = await action(
    new Request('https://example.com/api/remover/jobs/job_1'),
    { params: Promise.resolve({ id: 'job_1' }) }
  );

  assert.equal(response.status, 200);
  assert.equal(submittedJobId, 'job_1');
});
