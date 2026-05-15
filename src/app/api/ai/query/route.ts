import type { createApiContext } from '@/app/api/_lib/context';
import type { getAIService as getAIServiceFn } from '@/domains/ai/application/service';
import type {
  failAITaskByIdAndRefundCredit,
  UpdateAITask,
} from '@/domains/ai/infra/ai-task';
import type {
  AiProviderBindings,
  AiRuntimeSettings,
} from '@/domains/settings/application/settings-runtime.contracts';

import { AITaskStatus } from '@/extensions/ai';
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
  ServiceUnavailableError,
  UpstreamError,
} from '@/shared/lib/api/errors';
import { createLimiterFactory } from '@/shared/lib/api/limiters-factory';
import { jsonOk } from '@/shared/lib/api/response';
import { withApi } from '@/shared/lib/api/route';
import {
  resolveConfigConsistencyMode,
  type ConfigConsistencyMode,
} from '@/shared/lib/config-consistency';
import { safeJsonParse } from '@/shared/lib/json';
import { AiQueryBodySchema } from '@/shared/schemas/api/ai/query';

type MaybePromise<T> = T | Promise<T>;
type AiQueryApiContext = Pick<
  Awaited<ReturnType<typeof createApiContext>>,
  'log' | 'parseJson' | 'requireUser'
>;

type AiTaskLike = {
  id: string;
  taskId: string | null;
  userId: string;
  provider: string;
  status: string | null;
  model: string | null;
  prompt: string | null;
  taskInfo: string | null;
  taskResult?: string | null;
  creditId?: string | null;
};

type AiQueryRouteDeps = {
  resolveConfigConsistencyMode: typeof resolveConfigConsistencyMode;
  requireAiEnabled: () => Promise<void>;
  getApiContext: (req: Request) => MaybePromise<AiQueryApiContext>;
  findAITaskById: (id: string) => Promise<AiTaskLike | undefined>;
  updateAITaskById: (
    id: string,
    updateAITask: UpdateAITask
  ) => Promise<unknown>;
  failAITaskByIdAndRefundCredit: typeof failAITaskByIdAndRefundCredit;
  readAiRuntimeSettings: (
    mode: ConfigConsistencyMode
  ) => Promise<AiRuntimeSettings>;
  readAiProviderBindings: () => MaybePromise<AiProviderBindings>;
  getAIService: (input: {
    settings: AiRuntimeSettings;
    bindings: AiProviderBindings;
  }) => MaybePromise<Awaited<ReturnType<typeof getAIServiceFn>>>;
  rateLimiter: {
    checkAndConsume: (
      key: string,
      now?: number
    ) => Promise<{
      allowed: boolean;
      retryAfterSeconds?: number;
    }>;
    clear: (key: string) => Promise<void>;
  };
  now: () => number;
};

function getDefaultAiQueryRouteDeps(): AiQueryRouteDeps {
  return {
    resolveConfigConsistencyMode,
    requireAiEnabled: async () => {
      const mod = await import('@/app/api/ai/_lib/guard');
      await mod.requireAiEnabled();
    },
    getApiContext: async (req) => {
      const mod = await import('@/app/api/_lib/context');
      return mod.createApiContext(req) as AiQueryApiContext;
    },
    findAITaskById: async (id) => {
      const mod = await import('@/domains/ai/infra/ai-task');
      return await mod.findAITaskById(id);
    },
    updateAITaskById: async (id, updateAITask) => {
      const mod = await import('@/domains/ai/infra/ai-task');
      return await mod.updateAITaskById(id, updateAITask);
    },
    failAITaskByIdAndRefundCredit: async (input) => {
      const mod = await import('@/domains/ai/infra/ai-task');
      return await mod.failAITaskByIdAndRefundCredit(input);
    },
    readAiRuntimeSettings: async (_mode) => {
      const mod =
        await import('@/domains/settings/application/settings-runtime.query');
      return _mode === 'fresh'
        ? mod.readAiRuntimeSettingsFresh()
        : mod.readAiRuntimeSettingsCached();
    },
    readAiProviderBindings: async () => {
      const mod = await import('@/domains/ai/application/provider-bindings');
      return mod.getAiProviderBindings();
    },
    getAIService: async ({ settings, bindings }) => {
      const mod = await import('@/domains/ai/application/service');
      return mod.getAIService({ settings, bindings });
    },
    rateLimiter: createLimiterFactory().createAiQueryCooldownLimiter(),
    now: Date.now,
  };
}

function isFinalTaskStatus(status: string | null | undefined) {
  return (
    status === AITaskStatus.SUCCESS ||
    status === AITaskStatus.FAILED ||
    status === AITaskStatus.CANCELED
  );
}

function toTaskResponse(task: {
  id: string;
  status: string | null;
  provider: string;
  model: string | null;
  prompt: string | null;
  taskInfo: string | null;
}) {
  return {
    id: task.id,
    status: task.status,
    provider: task.provider,
    model: task.model,
    prompt: task.prompt,
    taskInfo: safeJsonParse(task.taskInfo),
  };
}

function buildAiQueryPostLogic(overrides: Partial<AiQueryRouteDeps> = {}) {
  const deps = { ...getDefaultAiQueryRouteDeps(), ...overrides };

  return async (req: Request) => {
    await deps.requireAiEnabled();

    const api = await deps.getApiContext(req);
    const { log } = api;
    const mode: ConfigConsistencyMode = deps.resolveConfigConsistencyMode(req);
    const { taskId } = await api.parseJson(AiQueryBodySchema);
    if (!taskId) {
      throw new BadRequestError('invalid params');
    }

    const user = await api.requireUser();

    const task = await deps.findAITaskById(taskId);
    if (!task || !task.taskId) {
      throw new NotFoundError('task not found');
    }

    if (task.userId !== user.id) {
      throw new ForbiddenError('no permission');
    }

    if (isFinalTaskStatus(task.status)) {
      await deps.rateLimiter.clear(task.id);
      return jsonOk(toTaskResponse(task), {
        headers: { 'Cache-Control': 'no-store' },
      });
    }

    if (!(await deps.rateLimiter.checkAndConsume(task.id)).allowed) {
      return jsonOk(toTaskResponse(task), {
        headers: { 'Cache-Control': 'no-store' },
      });
    }

    const settings = await deps.readAiRuntimeSettings(mode);
    const bindings = await deps.readAiProviderBindings();
    const aiService = await deps.getAIService({ settings, bindings });
    const aiProvider = aiService.getProvider(task.provider);
    if (!aiProvider) {
      throw new BadRequestError('invalid ai provider');
    }

    if (typeof aiProvider.query !== 'function') {
      log.error('ai: provider does not support query', {
        provider: task.provider,
        dbTaskId: task.id,
        providerTaskId: task.taskId,
      });
      throw new ServiceUnavailableError('ai provider does not support query');
    }

    const result = await aiProvider.query({
      taskId: task.taskId,
    });

    if (!result?.taskStatus) {
      log.error('ai: provider query returned invalid payload', {
        provider: task.provider,
        dbTaskId: task.id,
        providerTaskId: task.taskId,
      });
      throw new UpstreamError(502, 'ai task query failed');
    }

    const nextTaskInfo = result.taskInfo
      ? JSON.stringify(result.taskInfo)
      : null;
    const nextTaskResult = result.taskResult
      ? JSON.stringify(result.taskResult)
      : null;

    const updateAITask: UpdateAITask = {
      status: result.taskStatus,
      taskInfo: nextTaskInfo,
      taskResult: nextTaskResult,
    };

    const shouldUpdate =
      updateAITask.status !== task.status ||
      updateAITask.taskInfo !== task.taskInfo ||
      updateAITask.taskResult !== task.taskResult;

    if (shouldUpdate) {
      if (updateAITask.status === AITaskStatus.FAILED) {
        await deps.failAITaskByIdAndRefundCredit({
          id: task.id,
          updateAITask,
          creditId: task.creditId,
          refundLog: log,
        });
      } else {
        await deps.updateAITaskById(task.id, updateAITask);
      }
    }

    task.status = updateAITask.status || '';
    task.taskInfo = updateAITask.taskInfo ?? null;
    task.taskResult = updateAITask.taskResult ?? null;

    return jsonOk(toTaskResponse(task), {
      headers: { 'Cache-Control': 'no-store' },
    });
  };
}

export function createAiQueryPostHandler(
  overrides: Partial<AiQueryRouteDeps> = {}
) {
  return withApi(buildAiQueryPostLogic(overrides));
}

export const POST = withApi(buildAiQueryPostLogic());
