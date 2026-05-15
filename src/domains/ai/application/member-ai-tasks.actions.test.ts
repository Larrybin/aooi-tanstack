import assert from 'node:assert/strict';
import test from 'node:test';
import type { UpdateAITask } from '@/domains/ai/infra/ai-task';

import { refreshMemberAiTaskUseCase } from './member-ai-tasks.actions';

function createTaskCreditDeps(
  refunds: string[] = [],
  failedUpdates: Array<{ id: string; update: Record<string, unknown> }> = []
) {
  return {
    failAITaskByIdAndRefundCredit: async ({
      id,
      updateAITask,
      creditId,
    }: {
      id: string;
      updateAITask: UpdateAITask;
      creditId?: string | null;
    }) => {
      if (creditId) {
        refunds.push(creditId);
      }
      failedUpdates.push({
        id,
        update: updateAITask as Record<string, unknown>,
      });
      return { id, ...updateAITask } as never;
    },
    log: {
      error: () => undefined,
    },
  };
}

test('refreshMemberAiTaskUseCase 对不存在或越权任务返回 hidden', async () => {
  assert.deepEqual(
    await refreshMemberAiTaskUseCase(
      {
        taskId: 'task_1',
        actorUserId: 'user_1',
      },
      {
        ...createTaskCreditDeps(),
        findAITaskById: async () => undefined as never,
        updateAITaskById: async () => {
          throw new Error('should not update');
        },
        getProvider: async () => undefined,
      }
    ),
    { status: 'hidden' }
  );

  assert.deepEqual(
    await refreshMemberAiTaskUseCase(
      {
        taskId: 'task_1',
        actorUserId: 'user_1',
      },
      {
        ...createTaskCreditDeps(),
        findAITaskById: async () =>
          ({
            id: 'task_1',
            userId: 'other_user',
            taskId: 'provider_task_1',
            provider: 'kie',
            status: 'pending',
          }) as never,
        updateAITaskById: async () => {
          throw new Error('should not update');
        },
        getProvider: async () => undefined,
      }
    ),
    { status: 'hidden' }
  );
});

test('refreshMemberAiTaskUseCase 对 provider 缺失返回 invalid_provider', async () => {
  assert.deepEqual(
    await refreshMemberAiTaskUseCase(
      {
        taskId: 'task_1',
        actorUserId: 'user_1',
      },
      {
        ...createTaskCreditDeps(),
        findAITaskById: async () =>
          ({
            id: 'task_1',
            userId: 'user_1',
            taskId: 'provider_task_1',
            provider: 'kie',
            status: 'pending',
          }) as never,
        updateAITaskById: async () => {
          throw new Error('should not update');
        },
        getProvider: async () => undefined,
      }
    ),
    { status: 'invalid_provider' }
  );
});

test('refreshMemberAiTaskUseCase 对不支持 query 的 provider 返回 query_failed', async () => {
  assert.deepEqual(
    await refreshMemberAiTaskUseCase(
      {
        taskId: 'task_1',
        actorUserId: 'user_1',
      },
      {
        ...createTaskCreditDeps(),
        findAITaskById: async () =>
          ({
            id: 'task_1',
            userId: 'user_1',
            taskId: 'provider_task_1',
            provider: 'kie',
            status: 'pending',
          }) as never,
        updateAITaskById: async () => {
          throw new Error('should not update');
        },
        getProvider: async () =>
          ({
            name: 'kie',
            configs: {},
            generate: async () => {
              throw new Error('should not generate');
            },
          }) as never,
      }
    ),
    { status: 'query_failed' }
  );
});

test('refreshMemberAiTaskUseCase 对 pending/processing 查询 provider 并更新任务', async () => {
  const updates: Array<{ id: string; update: Record<string, unknown> }> = [];

  assert.deepEqual(
    await refreshMemberAiTaskUseCase(
      {
        taskId: 'task_1',
        actorUserId: 'user_1',
      },
      {
        ...createTaskCreditDeps(),
        findAITaskById: async () =>
          ({
            id: 'task_1',
            userId: 'user_1',
            taskId: 'provider_task_1',
            provider: 'kie',
            status: 'pending',
            creditId: 'credit_1',
          }) as never,
        updateAITaskById: async (id, update) => {
          updates.push({ id, update: update as Record<string, unknown> });
          return { id, ...update } as never;
        },
        getProvider: async () =>
          ({
            query: async () => ({
              taskStatus: 'success',
              taskInfo: { foo: 'bar' },
              taskResult: { id: 'result_1' },
            }),
          }) as never,
      }
    ),
    { status: 'ok' }
  );

  assert.equal(updates.length, 1);
  assert.equal(updates[0]?.id, 'task_1');
  assert.deepEqual(updates[0]?.update, {
    status: 'success',
    taskInfo: JSON.stringify({ foo: 'bar' }),
    taskResult: JSON.stringify({ id: 'result_1' }),
  });
});

test('refreshMemberAiTaskUseCase 在 provider 只返回 taskStatus 时仍更新状态并清空 taskInfo/taskResult', async () => {
  const updates: Array<{ id: string; update: Record<string, unknown> }> = [];

  assert.deepEqual(
    await refreshMemberAiTaskUseCase(
      {
        taskId: 'task_1',
        actorUserId: 'user_1',
      },
      {
        ...createTaskCreditDeps(),
        findAITaskById: async () =>
          ({
            id: 'task_1',
            userId: 'user_1',
            taskId: 'provider_task_1',
            provider: 'kie',
            status: 'processing',
            taskInfo: '{"step":"queued"}',
            taskResult: '{"old":true}',
            creditId: 'credit_1',
          }) as never,
        updateAITaskById: async (id, update) => {
          updates.push({ id, update: update as Record<string, unknown> });
          return { id, ...update } as never;
        },
        getProvider: async () =>
          ({
            query: async () => ({
              taskStatus: 'success',
            }),
          }) as never,
      }
    ),
    { status: 'ok' }
  );

  assert.equal(updates.length, 1);
  assert.equal(updates[0]?.id, 'task_1');
  assert.deepEqual(updates[0]?.update, {
    status: 'success',
    taskInfo: null,
    taskResult: null,
  });
});

test('refreshMemberAiTaskUseCase 在 provider 失败状态下显式退款且更新不携带 creditId', async () => {
  const refunds: string[] = [];
  const updates: Array<{ id: string; update: Record<string, unknown> }> = [];

  assert.deepEqual(
    await refreshMemberAiTaskUseCase(
      {
        taskId: 'task_1',
        actorUserId: 'user_1',
      },
      {
        ...createTaskCreditDeps(refunds, updates),
        findAITaskById: async () =>
          ({
            id: 'task_1',
            userId: 'user_1',
            taskId: 'provider_task_1',
            provider: 'kie',
            status: 'processing',
            taskInfo: null,
            taskResult: null,
            creditId: 'credit_1',
          }) as never,
        updateAITaskById: async () => {
          throw new Error('failed tasks should use atomic refund update');
        },
        getProvider: async () =>
          ({
            query: async () => ({
              taskStatus: 'failed',
            }),
          }) as never,
      }
    ),
    { status: 'ok' }
  );

  assert.deepEqual(refunds, ['credit_1']);
  assert.deepEqual(updates, [
    {
      id: 'task_1',
      update: {
        status: 'failed',
        taskInfo: null,
        taskResult: null,
      },
    },
  ]);
});

test('refreshMemberAiTaskUseCase 在 provider 返回无效 payload 时返回 query_failed', async () => {
  assert.deepEqual(
    await refreshMemberAiTaskUseCase(
      {
        taskId: 'task_1',
        actorUserId: 'user_1',
      },
      {
        ...createTaskCreditDeps(),
        findAITaskById: async () =>
          ({
            id: 'task_1',
            userId: 'user_1',
            taskId: 'provider_task_1',
            provider: 'kie',
            status: 'processing',
            creditId: 'credit_1',
          }) as never,
        updateAITaskById: async () => {
          throw new Error('should not update');
        },
        getProvider: async () =>
          ({
            query: async () => ({
              taskInfo: { step: 'still-processing' },
            }),
          }) as never,
      }
    ),
    { status: 'query_failed' }
  );
});

test('refreshMemberAiTaskUseCase 在 provider query 抛错时返回 query_failed', async () => {
  assert.deepEqual(
    await refreshMemberAiTaskUseCase(
      {
        taskId: 'task_1',
        actorUserId: 'user_1',
      },
      {
        ...createTaskCreditDeps(),
        findAITaskById: async () =>
          ({
            id: 'task_1',
            userId: 'user_1',
            taskId: 'provider_task_1',
            provider: 'kie',
            status: 'processing',
            creditId: 'credit_1',
          }) as never,
        updateAITaskById: async () => {
          throw new Error('should not update');
        },
        getProvider: async () =>
          ({
            query: async () => {
              throw new Error('upstream timeout');
            },
          }) as never,
      }
    ),
    { status: 'query_failed' }
  );
});

test('refreshMemberAiTaskUseCase 对非待处理状态不查询 provider', async () => {
  let providerCalls = 0;

  assert.deepEqual(
    await refreshMemberAiTaskUseCase(
      {
        taskId: 'task_1',
        actorUserId: 'user_1',
      },
      {
        ...createTaskCreditDeps(),
        findAITaskById: async () =>
          ({
            id: 'task_1',
            userId: 'user_1',
            taskId: 'provider_task_1',
            provider: 'kie',
            status: 'success',
          }) as never,
        updateAITaskById: async () => {
          throw new Error('should not update');
        },
        getProvider: async () => {
          providerCalls += 1;
          return undefined;
        },
      }
    ),
    { status: 'ok' }
  );

  assert.equal(providerCalls, 0);
});
