import type { resolveConfiguredAICapability } from '@/domains/ai/application/capabilities';
import type { getAiProviderBindings } from '@/domains/ai/application/provider-bindings';
import type { getAIService } from '@/domains/ai/application/service';
import type {
  createAITask,
  failAITaskByIdAndRefundCredit,
  NewAITask,
  updateAITaskById,
} from '@/domains/ai/infra/ai-task';
import type { AiRuntimeSettings } from '@/domains/settings/application/settings-runtime.contracts';
import { site } from '@/site';

import { AITaskStatus, type AIGenerateParams } from '@/extensions/ai';
import {
  BadRequestError,
  ForbiddenError,
  UpstreamError,
} from '@/shared/lib/api/errors';
import { jsonOk } from '@/shared/lib/api/response';
import { withApi } from '@/shared/lib/api/route';
import type { getUuid } from '@/shared/lib/hash';
import {
  AiGenerateBodySchema,
  type AiGenerateBody,
} from '@/shared/schemas/api/ai/generate';

type AiGenerateApiContext = {
  log: {
    debug: (message: string, meta?: unknown) => void;
    info: (message: string, meta?: unknown) => void;
    warn: (message: string, meta?: unknown) => void;
    error: (message: string, meta?: unknown) => void;
  };
  parseJson: (schema: typeof AiGenerateBodySchema) => Promise<AiGenerateBody>;
  requireUser: () => Promise<{ id: string }>;
};

function resolveAppUrlOrigin(appUrl: string): string {
  const raw = appUrl?.trim() || '';
  if (!raw) return site.brand.appUrl;

  try {
    return new URL(raw).origin;
  } catch {
    return site.brand.appUrl;
  }
}

export type AiGenerateRouteDeps = {
  requireAiEnabled: () => Promise<void>;
  createApiContext: (request: Request) => {
    log: AiGenerateApiContext['log'];
    parseJson: AiGenerateApiContext['parseJson'];
    requireUser: AiGenerateApiContext['requireUser'];
  };
  readAiRuntimeSettings: () => Promise<AiRuntimeSettings>;
  readAiProviderBindings: typeof getAiProviderBindings;
  getAIService: typeof getAIService;
  resolveConfiguredAICapability: typeof resolveConfiguredAICapability;
  createAITask: typeof createAITask;
  updateAITaskById: typeof updateAITaskById;
  failAITaskByIdAndRefundCredit: typeof failAITaskByIdAndRefundCredit;
  getUuid: typeof getUuid;
  getAiNotifyWebhookSecret: () => string;
  signAiNotifyCallback: (input: {
    provider: string;
    taskId: string;
    secret: string;
  }) => Promise<string>;
};

export function createAiGeneratePostAction(deps: AiGenerateRouteDeps) {
  return async (request: Request) => {
    await deps.requireAiEnabled();

    const api = deps.createApiContext(request);
    const { log } = api;
    const { provider, mediaType, model, prompt, options, scene } =
      await api.parseJson(AiGenerateBodySchema);

    const settings = await deps.readAiRuntimeSettings();
    const bindings = deps.readAiProviderBindings();
    const capability = deps.resolveConfiguredAICapability(settings, bindings, {
      mediaType,
      scene: scene || '',
      provider,
      model,
    });

    const aiService = deps.getAIService({ settings, bindings });
    const aiProvider = aiService.getProvider(capability.provider);
    if (!aiProvider) {
      throw new BadRequestError('invalid ai capability');
    }

    const user = await api.requireUser();
    const appUrl = resolveAppUrlOrigin('');
    const params: AIGenerateParams = {
      mediaType,
      model,
      prompt,
      options,
    };

    const newAITask: NewAITask = {
      id: deps.getUuid(),
      userId: user.id,
      mediaType,
      provider: capability.provider,
      model: capability.model,
      prompt,
      scene: capability.scene,
      options: options ? JSON.stringify(options) : null,
      status: AITaskStatus.PENDING,
      costCredits: capability.costCredits,
      taskId: null,
      taskInfo: null,
      taskResult: null,
    };

    let task: Awaited<ReturnType<typeof deps.createAITask>>;
    try {
      task = await deps.createAITask(newAITask);
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        error.message.startsWith('Insufficient credits')
      ) {
        throw new ForbiddenError('insufficient credits');
      }
      throw error;
    }

    const notifySecret = deps.getAiNotifyWebhookSecret();
    if (notifySecret) {
      const signature = await deps.signAiNotifyCallback({
        provider: capability.provider,
        taskId: task.id,
        secret: notifySecret,
      });
      const callbackUrl = new URL(
        `/api/ai/notify/${capability.provider}`,
        appUrl
      );
      callbackUrl.searchParams.set('task_id', task.id);
      callbackUrl.searchParams.set('sig', signature);
      params.callbackUrl = callbackUrl.toString();
    }

    let result: Awaited<ReturnType<typeof aiProvider.generate>>;
    try {
      result = await aiProvider.generate({ params });
    } catch (error: unknown) {
      log.error('ai: generate threw', {
        provider: capability.provider,
        mediaType,
        model: capability.model,
        dbTaskId: task.id,
        error,
      });
      await deps.failAITaskByIdAndRefundCredit({
        id: task.id,
        creditId: task.creditId,
        refundLog: log,
        updateAITask: {
          status: AITaskStatus.FAILED,
          taskInfo: JSON.stringify({ errorMessage: 'ai generate failed' }),
        },
      });
      throw new UpstreamError(502, 'ai generate failed');
    }

    if (!result?.taskId) {
      log.error('ai: generate returned invalid payload', {
        provider: capability.provider,
        mediaType,
        model: capability.model,
        dbTaskId: task.id,
        hasTaskId: Boolean(result?.taskId),
      });
      await deps.failAITaskByIdAndRefundCredit({
        id: task.id,
        creditId: task.creditId,
        refundLog: log,
        updateAITask: {
          status: AITaskStatus.FAILED,
          taskInfo: JSON.stringify({ errorMessage: 'ai generate failed' }),
        },
      });
      throw new UpstreamError(502, 'ai generate failed');
    }

    const nextTaskInfo = result.taskInfo
      ? JSON.stringify(result.taskInfo)
      : null;
    const nextTaskResult = result.taskResult
      ? JSON.stringify(result.taskResult)
      : null;

    const updated = await deps.updateAITaskById(task.id, {
      taskId: result.taskId,
      taskInfo: nextTaskInfo,
      taskResult: nextTaskResult,
    });

    return jsonOk(updated, { headers: { 'Cache-Control': 'no-store' } });
  };
}

export function createAiGeneratePostHandler(deps: AiGenerateRouteDeps) {
  return withApi(createAiGeneratePostAction(deps));
}
