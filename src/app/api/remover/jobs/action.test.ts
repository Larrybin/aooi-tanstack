import assert from 'node:assert/strict';
import test from 'node:test';

import type { RemoverActor } from '@/domains/remover/domain/types';
import type { RemoverJob } from '@/domains/remover/infra/job';

import { createRemoverJobsPostAction } from './action';

const actor = {
  kind: 'anonymous',
  anonymousSessionId: 'anon_1',
} satisfies RemoverActor;

const queuedJob = {
  id: 'job_1',
  userId: null,
  anonymousSessionId: 'anon_1',
  provider: 'cloudflare-workers-ai',
  model: '@cf/model',
  providerTaskId: null,
  status: 'queued',
  inputImageAssetId: 'input_asset',
  maskImageAssetId: 'mask_asset',
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
} satisfies RemoverJob;

test('jobs action submits reused queued jobs so idempotency replay can recover', async () => {
  let submittedJobId = '';
  const action = createRemoverJobsPostAction({
    createApiContext: () =>
      ({
        parseJson: async () => ({
          inputImageAssetId: 'input_asset',
          maskImageAssetId: 'mask_asset',
          idempotencyKey: 'idem_job_1',
        }),
      }) as never,
    resolveActor: async () => actor,
    resolveProviderAdapter: async () =>
      ({
        config: {
          provider: 'cloudflare-workers-ai',
          model: '@cf/model',
        },
      }) as never,
    createQueuedRemoverJob: async () => ({
      job: queuedJob,
      reused: true,
    }),
    submitRemoverJobToProvider: async ({ jobId }) => {
      submittedJobId = jobId;
      return {
        ...queuedJob,
        status: 'processing',
        providerTaskId: 'provider_task_1',
      };
    },
    jobDeps: {} as never,
    submitDeps: {} as never,
  });

  const response = await action(
    new Request('https://example.com/api/remover/jobs', { method: 'POST' })
  );
  const body = (await response.json()) as {
    data: {
      reused: boolean;
      job: {
        status: string;
      };
    };
  };

  assert.equal(response.status, 200);
  assert.equal(submittedJobId, 'job_1');
  assert.equal(body.data.reused, true);
  assert.equal(body.data.job.status, 'processing');
  assert.equal('providerTaskId' in body.data.job, false);
});

test('jobs action resubmits stale processing jobs without provider task ids', async () => {
  let submittedJobId = '';
  const action = createRemoverJobsPostAction({
    createApiContext: () =>
      ({
        parseJson: async () => ({
          inputImageAssetId: 'input_asset',
          maskImageAssetId: 'mask_asset',
          idempotencyKey: 'idem_job_1',
        }),
      }) as never,
    resolveActor: async () => actor,
    resolveProviderAdapter: async () =>
      ({
        config: {
          provider: 'cloudflare-workers-ai',
          model: '@cf/model',
        },
      }) as never,
    createQueuedRemoverJob: async () => ({
      job: {
        ...queuedJob,
        status: 'processing',
        providerTaskId: null,
      },
      reused: true,
    }),
    submitRemoverJobToProvider: async ({ jobId }) => {
      submittedJobId = jobId;
      return {
        ...queuedJob,
        status: 'processing',
        providerTaskId: 'provider_task_1',
      };
    },
    jobDeps: {} as never,
    submitDeps: {} as never,
  });

  const response = await action(
    new Request('https://example.com/api/remover/jobs', { method: 'POST' })
  );

  assert.equal(response.status, 200);
  assert.equal(submittedJobId, 'job_1');
});

test('jobs action applies anonymous guest IP limiter around job creation', async () => {
  let acquired = false;
  let released = false;
  const action = createRemoverJobsPostAction({
    createApiContext: () =>
      ({
        parseJson: async () => ({
          inputImageAssetId: 'input_asset',
          maskImageAssetId: 'mask_asset',
          idempotencyKey: 'idem_job_1',
        }),
      }) as never,
    resolveActor: async () => actor,
    resolveProviderAdapter: async () =>
      ({
        config: {
          provider: 'cloudflare-workers-ai',
          model: '@cf/model',
        },
      }) as never,
    createQueuedRemoverJob: async () => ({
      job: queuedJob,
      reused: false,
    }),
    submitRemoverJobToProvider: async () => queuedJob,
    acquireGuestIpLimit: async ({ req }) => {
      acquired = req.headers.get('cf-connecting-ip') === '203.0.113.1';
      return async () => {
        released = true;
      };
    },
    jobDeps: {} as never,
    submitDeps: {} as never,
  });

  await action(
    new Request('https://example.com/api/remover/jobs', {
      method: 'POST',
      headers: {
        'cf-connecting-ip': '203.0.113.1',
      },
    })
  );

  assert.equal(acquired, true);
  assert.equal(released, true);
});
