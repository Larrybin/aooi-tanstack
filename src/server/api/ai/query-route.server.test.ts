import assert from 'node:assert/strict';
import test from 'node:test';

import { AITaskStatus } from '@/extensions/ai';
import type { AiProviderBindings, AiRuntimeSettings } from '@/domains/settings/application/settings-runtime.contracts';

import { createAiQueryPostHandler, type AiQueryRouteDeps } from './query-route';

const SETTINGS: AiRuntimeSettings = { aiEnabled: true };
const BINDINGS: AiProviderBindings = {
  openrouterApiKey: '',
  replicateApiToken: 'token',
  falApiKey: '',
  kieApiKey: '',
};

function createDeps(overrides: Partial<AiQueryRouteDeps> = {}): AiQueryRouteDeps {
  const log = {
    debug() {},
    info() {},
    warn() {},
    error() {},
  };

  return {
    resolveConfigConsistencyMode: () => 'cached',
    requireAiEnabled: async () => undefined,
    getApiContext: () => ({
      log,
      parseJson: async () => ({ taskId: 'task_1' }),
      requireUser: async () => ({ id: 'user_1' }),
    }),
    findAITaskById: async () => ({
      id: 'task_1',
      taskId: 'provider_task_1',
      userId: 'user_1',
      provider: 'replicate',
      status: AITaskStatus.RUNNING,
      model: 'model_1',
      prompt: 'prompt',
      taskInfo: null,
      taskResult: null,
      creditId: 'credit_1',
    }),
    updateAITaskById: async () => undefined,
    failAITaskByIdAndRefundCredit: async () => undefined,
    readAiRuntimeSettings: async () => SETTINGS,
    readAiProviderBindings: async () => BINDINGS,
    getAIService: async () => ({
      getProvider: () => ({
        query: async () => ({
          taskStatus: AITaskStatus.SUCCESS,
          taskInfo: { progress: 100 },
          taskResult: { url: 'https://example.com/result.png' },
        }),
      }),
      getDefaultProvider: () => undefined,
      getMediaTypes: () => [],
    }),
    rateLimiter: {
      checkAndConsume: async () => ({ allowed: true }),
      clear: async () => undefined,
    },
    ...overrides,
  };
}

test('ai query returns final task without provider query and clears cooldown', async () => {
  let cleared = false;
  let providerQueried = false;
  const handler = createAiQueryPostHandler(
    createDeps({
      findAITaskById: async () => ({
        id: 'task_1',
        taskId: 'provider_task_1',
        userId: 'user_1',
        provider: 'replicate',
        status: AITaskStatus.SUCCESS,
        model: 'model_1',
        prompt: 'prompt',
        taskInfo: '{"progress":100}',
        taskResult: null,
        creditId: 'credit_1',
      }),
      getAIService: async () => {
        providerQueried = true;
        throw new Error('should not query provider');
      },
      rateLimiter: {
        checkAndConsume: async () => ({ allowed: true }),
        clear: async () => {
          cleared = true;
        },
      },
    })
  );

  const response = await handler(new Request('http://localhost/api/ai/query'));
  const body = (await response.json()) as { data: { status: string } };

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(body.data.status, AITaskStatus.SUCCESS);
  assert.equal(cleared, true);
  assert.equal(providerQueried, false);
});

test('ai query returns current task when cooldown limiter denies query', async () => {
  let providerQueried = false;
  const handler = createAiQueryPostHandler(
    createDeps({
      getAIService: async () => {
        providerQueried = true;
        throw new Error('should not query provider');
      },
      rateLimiter: {
        checkAndConsume: async () => ({ allowed: false }),
        clear: async () => undefined,
      },
    })
  );

  const response = await handler(new Request('http://localhost/api/ai/query'));
  const body = (await response.json()) as { data: { status: string } };

  assert.equal(response.status, 200);
  assert.equal(body.data.status, AITaskStatus.RUNNING);
  assert.equal(providerQueried, false);
});

test('ai query updates task from provider result', async () => {
  const updates: unknown[] = [];
  const handler = createAiQueryPostHandler(
    createDeps({
      updateAITaskById: async (_id, update) => {
        updates.push(update);
      },
    })
  );

  const response = await handler(new Request('http://localhost/api/ai/query'));
  const body = (await response.json()) as { data: { status: string; taskInfo: unknown } };

  assert.equal(response.status, 200);
  assert.equal(body.data.status, AITaskStatus.SUCCESS);
  assert.deepEqual(body.data.taskInfo, { progress: 100 });
  assert.equal(updates.length, 1);
});

test('ai query refunds credit when provider reports failed task', async () => {
  const refunds: unknown[] = [];
  const handler = createAiQueryPostHandler(
    createDeps({
      getAIService: async () => ({
        getProvider: () => ({
          query: async () => ({ taskStatus: AITaskStatus.FAILED }),
        }),
        getDefaultProvider: () => undefined,
        getMediaTypes: () => [],
      }),
      failAITaskByIdAndRefundCredit: async (input) => {
        refunds.push(input);
      },
    })
  );

  const response = await handler(new Request('http://localhost/api/ai/query'));
  const body = (await response.json()) as { data: { status: string } };

  assert.equal(response.status, 200);
  assert.equal(body.data.status, AITaskStatus.FAILED);
  assert.equal(refunds.length, 1);
});
