import assert from 'node:assert/strict';
import test from 'node:test';

import { AIMediaType, AITaskStatus, type AIProvider } from '@/extensions/ai';
import { BadRequestError } from '@/shared/lib/api/errors';

import {
  createAiGeneratePostHandler,
  type AiGenerateRouteDeps,
} from './generate-route';

type AiGenerateCreateApiContext = AiGenerateRouteDeps['createApiContext'];
type NewAiTask = Parameters<AiGenerateRouteDeps['createAITask']>[0];
type AiTaskRecord = Awaited<ReturnType<AiGenerateRouteDeps['createAITask']>>;
type UpdateAiTaskPatch = Parameters<AiGenerateRouteDeps['updateAITaskById']>[1];

function createApiContextStub(body: {
  provider: string;
  mediaType: AIMediaType;
  model: string;
  prompt?: string;
  options?: Record<string, unknown>;
  scene?: string;
}): AiGenerateCreateApiContext {
  return () => ({
    log: {
      debug: () => undefined,
      info: () => undefined,
      warn: () => undefined,
      error: () => undefined,
    },
    parseJson: async () => body,
    requireUser: async () => ({ id: 'user_1' }),
  });
}

function createAiTaskRecord(
  task: NewAiTask,
  overrides: Partial<AiTaskRecord> = {}
): AiTaskRecord {
  return {
    id: task.id,
    userId: task.userId,
    mediaType: task.mediaType,
    provider: task.provider,
    model: task.model,
    prompt: task.prompt,
    options: task.options ?? null,
    status: task.status,
    createdAt: new Date('2026-04-01T00:00:00.000Z'),
    updatedAt: new Date('2026-04-01T00:00:00.000Z'),
    deletedAt: null,
    taskId: task.taskId ?? null,
    taskInfo: task.taskInfo ?? null,
    taskResult: task.taskResult ?? null,
    costCredits: task.costCredits ?? 0,
    scene: task.scene ?? '',
    creditId: task.creditId ?? null,
    ...overrides,
  };
}

function createAiGenerateProvider(): AIProvider {
  return {
    name: 'replicate',
    configs: {},
    generate: async () => ({
      taskStatus: AITaskStatus.PROCESSING,
      taskId: 'provider-task-1',
      taskInfo: { step: 'queued' },
    }),
  };
}

function createAiNotifyDeps(secret = '') {
  return {
    getAiNotifyWebhookSecret: () => secret,
    signAiNotifyCallback: async ({
      provider,
      taskId,
      secret,
    }: {
      provider: string;
      taskId: string;
      secret: string;
    }) => `signed-${provider}-${taskId}-${secret}`,
  };
}

function createAiCreditRefundDeps(
  refunds: string[] = [],
  failedUpdates: UpdateAiTaskPatch[] = []
) {
  return {
    failAITaskByIdAndRefundCredit: async ({
      id,
      creditId,
      updateAITask,
    }: {
      id: string;
      creditId?: string | null;
      updateAITask: UpdateAiTaskPatch;
    }) => {
      if (creditId) {
        refunds.push(creditId);
      }
      failedUpdates.push(updateAITask);
      return createAiTaskRecord(
        {
          id,
          userId: 'user_1',
          mediaType: AIMediaType.IMAGE,
          provider: 'replicate',
          model: 'google/nano-banana',
          prompt: 'hello',
          status: AITaskStatus.PENDING,
        },
        updateAITask
      );
    },
  };
}

function createEmptyAiService() {
  return {
    getProvider: () => undefined,
    getDefaultProvider: () => undefined,
    getMediaTypes: () => [],
  };
}

test('ai/generate 路由使用 resolver 返回的 canonical scene 和 costCredits', async () => {
  let createdTask: Record<string, unknown> | undefined;

  const handler = createAiGeneratePostHandler({
    requireAiEnabled: async () => undefined,
    createApiContext: createApiContextStub({
      mediaType: AIMediaType.IMAGE,
      scene: 'input-scene',
      provider: 'replicate',
      model: 'raw-model',
      prompt: 'hello',
      options: { image_input: ['https://example.com/a.png'] },
    }),
    readAiRuntimeSettings: async () => ({ aiEnabled: true }),
    readAiProviderBindings: () => ({
      openrouterApiKey: '',
      replicateApiToken: 'token_1',
      falApiKey: '',
      kieApiKey: '',
    }),
    resolveConfiguredAICapability: () => ({
      mediaType: AIMediaType.IMAGE,
      scene: 'image-to-image',
      provider: 'replicate',
      model: 'google/nano-banana',
      label: 'Nano Banana',
      costCredits: 4,
      isDefault: true,
    }),
    getAIService: () => ({
      getProvider: () => createAiGenerateProvider(),
      getDefaultProvider: () => undefined,
      getMediaTypes: () => [],
    }),
    getUuid: () => 'db-task-1',
    createAITask: async (task) => {
      createdTask = task as Record<string, unknown>;
      return createAiTaskRecord(task, {
        creditId: 'credit-1',
      });
    },
    updateAITaskById: async (_id, patch: UpdateAiTaskPatch) =>
      createAiTaskRecord(
        {
          id: 'db-task-1',
          userId: 'user_1',
          mediaType: AIMediaType.IMAGE,
          provider: 'replicate',
          model: 'google/nano-banana',
          prompt: 'hello',
          status: AITaskStatus.PENDING,
        },
        patch
      ),
    ...createAiCreditRefundDeps(),
    ...createAiNotifyDeps(),
  });

  const response = await handler(
    new Request('http://localhost/api/ai/generate', { method: 'POST' })
  );

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.ok(createdTask);
  assert.equal(createdTask.scene, 'image-to-image');
  assert.equal(createdTask.costCredits, 4);
  assert.equal(createdTask.provider, 'replicate');
  assert.equal(createdTask.model, 'google/nano-banana');

  const body = (await response.json()) as {
    data: { taskId: string; taskInfo: string };
  };
  assert.equal(body.data.taskId, 'provider-task-1');
  assert.equal(body.data.taskInfo, JSON.stringify({ step: 'queued' }));
});

test('ai/generate 路由非法 capability 统一返回 400', async () => {
  const handler = createAiGeneratePostHandler({
    requireAiEnabled: async () => undefined,
    createApiContext: createApiContextStub({
      mediaType: AIMediaType.MUSIC,
      scene: 'text-to-music',
      provider: 'kie',
      model: 'V5',
      prompt: 'hello',
    }),
    readAiRuntimeSettings: async () => ({ aiEnabled: true }),
    readAiProviderBindings: () => ({
      openrouterApiKey: '',
      replicateApiToken: '',
      falApiKey: '',
      kieApiKey: 'key_1',
    }),
    resolveConfiguredAICapability: () => {
      throw new BadRequestError('invalid ai capability');
    },
    getAIService: createEmptyAiService,
    getUuid: () => 'db-task-1',
    createAITask: async () => {
      throw new Error('should not create task');
    },
    updateAITaskById: async () => {
      throw new Error('should not update task');
    },
    ...createAiCreditRefundDeps(),
    ...createAiNotifyDeps(),
  } satisfies AiGenerateRouteDeps);

  const response = await handler(
    new Request('http://localhost/api/ai/generate', { method: 'POST' })
  );

  assert.equal(response.status, 400);

  const body = (await response.json()) as {
    code: number;
    message: string;
  };
  assert.equal(body.code, -1);
  assert.equal(body.message, 'invalid ai capability');
});

test('ai/generate 未配置 notify secret 时不传 callbackUrl', async () => {
  let callbackUrl: string | undefined;
  const handler = createAiGeneratePostHandler({
    requireAiEnabled: async () => undefined,
    createApiContext: createApiContextStub({
      mediaType: AIMediaType.IMAGE,
      provider: 'replicate',
      model: 'raw-model',
      prompt: 'hello',
    }),
    readAiRuntimeSettings: async () => ({ aiEnabled: true }),
    readAiProviderBindings: () => ({
      openrouterApiKey: '',
      replicateApiToken: 'token_1',
      falApiKey: '',
      kieApiKey: '',
    }),
    resolveConfiguredAICapability: () => ({
      mediaType: AIMediaType.IMAGE,
      scene: 'text-to-image',
      provider: 'replicate',
      model: 'google/nano-banana',
      label: 'Nano Banana',
      costCredits: 4,
      isDefault: true,
    }),
    getAIService: () => ({
      getProvider: () => ({
        ...createAiGenerateProvider(),
        generate: async ({ params }) => {
          callbackUrl = params.callbackUrl;
          return {
            taskStatus: AITaskStatus.PROCESSING,
            taskId: 'provider-task-1',
          };
        },
      }),
      getDefaultProvider: () => undefined,
      getMediaTypes: () => [],
    }),
    getUuid: () => 'db-task-1',
    createAITask: async (task) => createAiTaskRecord(task),
    updateAITaskById: async (_id, patch) =>
      createAiTaskRecord(
        {
          id: 'db-task-1',
          userId: 'user_1',
          mediaType: AIMediaType.IMAGE,
          provider: 'replicate',
          model: 'google/nano-banana',
          prompt: 'hello',
          status: AITaskStatus.PENDING,
        },
        patch
      ),
    ...createAiCreditRefundDeps(),
    ...createAiNotifyDeps(),
  });

  const response = await handler(
    new Request('http://localhost/api/ai/generate', { method: 'POST' })
  );

  assert.equal(response.status, 200);
  assert.equal(callbackUrl, undefined);
});

test('ai/generate 配置 notify secret 时传签名 callbackUrl', async () => {
  let callbackUrl = '';
  const handler = createAiGeneratePostHandler({
    requireAiEnabled: async () => undefined,
    createApiContext: createApiContextStub({
      mediaType: AIMediaType.IMAGE,
      provider: 'replicate',
      model: 'raw-model',
      prompt: 'hello',
    }),
    readAiRuntimeSettings: async () => ({ aiEnabled: true }),
    readAiProviderBindings: () => ({
      openrouterApiKey: '',
      replicateApiToken: 'token_1',
      falApiKey: '',
      kieApiKey: '',
    }),
    resolveConfiguredAICapability: () => ({
      mediaType: AIMediaType.IMAGE,
      scene: 'text-to-image',
      provider: 'replicate',
      model: 'google/nano-banana',
      label: 'Nano Banana',
      costCredits: 4,
      isDefault: true,
    }),
    getAIService: () => ({
      getProvider: () => ({
        ...createAiGenerateProvider(),
        generate: async ({ params }) => {
          callbackUrl = params.callbackUrl || '';
          return {
            taskStatus: AITaskStatus.PROCESSING,
            taskId: 'provider-task-1',
          };
        },
      }),
      getDefaultProvider: () => undefined,
      getMediaTypes: () => [],
    }),
    getUuid: () => 'db-task-1',
    createAITask: async (task) => createAiTaskRecord(task),
    updateAITaskById: async (_id, patch) =>
      createAiTaskRecord(
        {
          id: 'db-task-1',
          userId: 'user_1',
          mediaType: AIMediaType.IMAGE,
          provider: 'replicate',
          model: 'google/nano-banana',
          prompt: 'hello',
          status: AITaskStatus.PENDING,
        },
        patch
      ),
    ...createAiCreditRefundDeps(),
    ...createAiNotifyDeps('secret_1'),
  });

  const response = await handler(
    new Request('http://localhost/api/ai/generate', { method: 'POST' })
  );

  assert.equal(response.status, 200);
  const parsed = new URL(callbackUrl);
  assert.equal(parsed.pathname, '/api/ai/notify/replicate');
  assert.equal(parsed.searchParams.get('task_id'), 'db-task-1');
  assert.equal(
    parsed.searchParams.get('sig'),
    'signed-replicate-db-task-1-secret_1'
  );
});

test('ai/generate provider 抛错时显式退款且失败更新不携带 creditId', async () => {
  const refunds: string[] = [];
  const updates: UpdateAiTaskPatch[] = [];
  const handler = createAiGeneratePostHandler({
    requireAiEnabled: async () => undefined,
    createApiContext: createApiContextStub({
      mediaType: AIMediaType.IMAGE,
      provider: 'replicate',
      model: 'raw-model',
      prompt: 'hello',
    }),
    readAiRuntimeSettings: async () => ({ aiEnabled: true }),
    readAiProviderBindings: () => ({
      openrouterApiKey: '',
      replicateApiToken: 'token_1',
      falApiKey: '',
      kieApiKey: '',
    }),
    resolveConfiguredAICapability: () => ({
      mediaType: AIMediaType.IMAGE,
      scene: 'text-to-image',
      provider: 'replicate',
      model: 'google/nano-banana',
      label: 'Nano Banana',
      costCredits: 4,
      isDefault: true,
    }),
    getAIService: () => ({
      getProvider: () => ({
        ...createAiGenerateProvider(),
        generate: async () => {
          throw new Error('provider failed');
        },
      }),
      getDefaultProvider: () => undefined,
      getMediaTypes: () => [],
    }),
    getUuid: () => 'db-task-1',
    createAITask: async (task) =>
      createAiTaskRecord(task, { creditId: 'credit-1' }),
    updateAITaskById: async () => {
      throw new Error('failed tasks should use atomic refund update');
    },
    ...createAiCreditRefundDeps(refunds, updates),
    ...createAiNotifyDeps(),
  });

  const response = await handler(
    new Request('http://localhost/api/ai/generate', { method: 'POST' })
  );

  assert.equal(response.status, 502);
  assert.deepEqual(refunds, ['credit-1']);
  assert.equal(updates.length, 1);
  assert.deepEqual(updates[0], {
    status: AITaskStatus.FAILED,
    taskInfo: JSON.stringify({ errorMessage: 'ai generate failed' }),
  });
});

test('ai/generate credits 不足时不创建任务、不退款、不更新任务', async () => {
  const refunds: string[] = [];
  let createCalls = 0;
  let updateCalls = 0;
  const handler = createAiGeneratePostHandler({
    requireAiEnabled: async () => undefined,
    createApiContext: createApiContextStub({
      mediaType: AIMediaType.IMAGE,
      provider: 'replicate',
      model: 'raw-model',
      prompt: 'hello',
    }),
    readAiRuntimeSettings: async () => ({ aiEnabled: true }),
    readAiProviderBindings: () => ({
      openrouterApiKey: '',
      replicateApiToken: 'token_1',
      falApiKey: '',
      kieApiKey: '',
    }),
    resolveConfiguredAICapability: () => ({
      mediaType: AIMediaType.IMAGE,
      scene: 'text-to-image',
      provider: 'replicate',
      model: 'google/nano-banana',
      label: 'Nano Banana',
      costCredits: 4,
      isDefault: true,
    }),
    getAIService: () => ({
      getProvider: () => createAiGenerateProvider(),
      getDefaultProvider: () => undefined,
      getMediaTypes: () => [],
    }),
    getUuid: () => 'db-task-1',
    createAITask: async () => {
      createCalls += 1;
      throw new Error('Insufficient credits: need 4');
    },
    updateAITaskById: async () => {
      updateCalls += 1;
      throw new Error('should not update task');
    },
    ...createAiCreditRefundDeps(refunds),
    ...createAiNotifyDeps(),
  });

  const response = await handler(
    new Request('http://localhost/api/ai/generate', { method: 'POST' })
  );

  assert.equal(response.status, 403);
  assert.equal(createCalls, 1);
  assert.equal(updateCalls, 0);
  assert.deepEqual(refunds, []);
});
