import type {
  AITask,
  failAITaskByIdAndRefundCredit,
  findAITaskById,
  UpdateAITask,
  updateAITaskById,
} from '@/domains/ai/infra/ai-task';

import { AITaskStatus, type AIProvider } from '@/extensions/ai';

type RefreshMemberAiTaskDeps = {
  findAITaskById: typeof findAITaskById;
  updateAITaskById: typeof updateAITaskById;
  failAITaskByIdAndRefundCredit: typeof failAITaskByIdAndRefundCredit;
  getProvider: (name: string) => Promise<AIProvider | undefined>;
  log: {
    error: (message: string, meta?: unknown) => void;
  };
};

export async function refreshMemberAiTaskUseCase(
  input: {
    taskId: string;
    actorUserId: string;
  },
  deps?: RefreshMemberAiTaskDeps
): Promise<
  | { status: 'hidden' }
  | { status: 'invalid_provider' }
  | { status: 'query_failed' }
  | { status: 'ok' }
> {
  const resolvedDeps = deps ?? (await getRefreshMemberAiTaskDeps());
  const task = await resolvedDeps.findAITaskById(input.taskId);
  if (!hasRefreshableTaskTarget(task)) {
    return { status: 'hidden' };
  }

  if (task.userId !== input.actorUserId) {
    return { status: 'hidden' };
  }

  if (
    ![AITaskStatus.PENDING, AITaskStatus.PROCESSING].includes(
      task.status as AITaskStatus
    )
  ) {
    return { status: 'ok' };
  }

  const aiProvider = await resolvedDeps.getProvider(task.provider);
  if (!aiProvider) {
    return { status: 'invalid_provider' };
  }

  if (!aiProvider.query) {
    return { status: 'query_failed' };
  }

  let result:
    | {
        taskStatus: string;
        taskInfo?: unknown;
        taskResult?: unknown;
      }
    | undefined;

  try {
    result = await aiProvider.query({
      taskId: task.taskId,
    });
  } catch {
    return { status: 'query_failed' };
  }

  if (!result?.taskStatus) {
    return { status: 'query_failed' };
  }

  const update = buildTaskUpdate(result);
  if (shouldUpdateTask(task, update)) {
    if (update.status === AITaskStatus.FAILED) {
      await resolvedDeps.failAITaskByIdAndRefundCredit({
        id: task.id,
        updateAITask: update,
        creditId: task.creditId,
        refundLog: resolvedDeps.log,
      });
    } else {
      await resolvedDeps.updateAITaskById(task.id, update);
    }
  }

  return { status: 'ok' };
}

function buildTaskUpdate(result: {
  taskStatus: string;
  taskInfo?: unknown;
  taskResult?: unknown;
}): UpdateAITask {
  return {
    status: result.taskStatus,
    taskInfo: result.taskInfo ? JSON.stringify(result.taskInfo) : null,
    taskResult: result.taskResult ? JSON.stringify(result.taskResult) : null,
  };
}

function shouldUpdateTask(
  task: Pick<AITask, 'status' | 'taskInfo' | 'taskResult'>,
  update: UpdateAITask
) {
  return (
    update.status !== task.status ||
    update.taskInfo !== (task.taskInfo ?? null) ||
    update.taskResult !== (task.taskResult ?? null)
  );
}

function hasRefreshableTaskTarget(task: AITask | undefined): task is AITask & {
  taskId: string;
  provider: string;
  status: string;
} {
  return Boolean(task?.taskId && task?.provider && task?.status);
}

async function getRefreshMemberAiTaskDeps(): Promise<RefreshMemberAiTaskDeps> {
  const [aiTaskModule, serviceModule, loggerModule] = await Promise.all([
    import('@/domains/ai/infra/ai-task'),
    import('@/domains/ai/application/service'),
    import('@/infra/platform/logging/logger.server'),
  ]);
  const [{ readAiRuntimeSettingsCached }, { getAiProviderBindings }] =
    await Promise.all([
      import('@/domains/settings/application/settings-runtime.query'),
      import('@/domains/ai/application/provider-bindings'),
    ]);

  return {
    findAITaskById: aiTaskModule.findAITaskById,
    updateAITaskById: aiTaskModule.updateAITaskById,
    failAITaskByIdAndRefundCredit: aiTaskModule.failAITaskByIdAndRefundCredit,
    getProvider: async (name) => {
      const aiService = serviceModule.getAIService({
        settings: await readAiRuntimeSettingsCached(),
        bindings: getAiProviderBindings(),
      });
      return aiService.getProvider(name);
    },
    log: loggerModule.createUseCaseLogger({
      domain: 'ai',
      useCase: 'refresh-member-ai-task',
    }),
  };
}
