'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';
import { resolveAICapabilitySelection } from '@/domains/ai/domain/capability-selection';
import { toast } from 'sonner';

import { defaultLocale } from '@/config/locale';
import { AITaskStatus, type AIMediaType } from '@/extensions/ai';
import { usePublicAppContext } from '@/shared/contexts/app';
import { useAIGenerationTask } from '@/shared/hooks/use-ai-generation-task';
import { useCreditsGate } from '@/shared/hooks/use-credits-gate';
import {
  resolveSelfUserDetailsForAction,
  useSelfUserDetails,
} from '@/shared/hooks/use-self-user-details';
import { isPlainObject } from '@/shared/lib/api/client';
import { fetchJson, toastFetchError } from '@/shared/lib/api/fetch-json';
import {
  formatMessageWithRequestId,
  getRequestIdFromError,
  RequestIdError,
} from '@/shared/lib/api/request-id';
import { withCallbackUrl } from '@/shared/lib/callback-url';
import { localizeCallbackUrl } from '@/shared/lib/localize-callback-url';
import type { AICapability } from '@/shared/types/ai-capability';
import type { SelfUserDetails } from '@/shared/types/auth-session';

export type AIGenerationTaskResponse = {
  id: string;
  status: string;
  provider: string;
  model: string | null;
  prompt: string | null;
  taskInfo: Record<string, unknown> | null;
};

type AIGenerationControllerMessages = {
  loadAccountDetailsFailed: string;
  refreshAccountDetailsFailed: string;
  loadCapabilitiesFailed: string;
  invalidProviderOrModel: string;
  insufficientCredits: string;
  createTaskFailed: string;
  queryTaskFailed: string;
  timeout: string;
  unknownError: string;
  createTaskFailedWithReason: (reason: string) => string;
  queryTaskFailedWithReason: (reason: string) => string;
};

type AIGenerationControllerHelpers = {
  setProgress: Dispatch<SetStateAction<number>>;
};

type AIGenerationTaskHandlerContext<
  TPayload extends Record<string, unknown> | null,
> = {
  task: AIGenerationTaskResponse;
  payload: TPayload;
  helpers: AIGenerationControllerHelpers;
};

export type AIGenerationTaskAdapter<
  TPayload extends Record<string, unknown> | null = Record<
    string,
    unknown
  > | null,
> = {
  initialProgress?: number;
  pollIntervalMs?: number;
  timeoutMs?: number;
  onStart?: () => void;
  parsePollingPayload?: (task: AIGenerationTaskResponse) => TPayload;
  handlePending?: (context: AIGenerationTaskHandlerContext<TPayload>) => void;
  handleProcessing?: (
    context: AIGenerationTaskHandlerContext<TPayload>
  ) => void;
  handleSuccess?: (context: AIGenerationTaskHandlerContext<TPayload>) => void;
  handleFailed?: (
    context: AIGenerationTaskHandlerContext<TPayload>
  ) => string | void;
};

type UseAiGenerationControllerOptions<
  TFormState,
  TPayload extends Record<string, unknown> | null,
> = {
  locale: string;
  mediaType: AIMediaType;
  initialSelection?: {
    scene?: string;
    provider?: string;
    model?: string;
  };
  buildRequestBody: (args: {
    formState: TFormState;
    capability: AICapability;
  }) => unknown;
  adapter?: AIGenerationTaskAdapter<TPayload>;
  messages: AIGenerationControllerMessages;
};

function isAICapability(value: unknown): value is AICapability {
  return (
    isPlainObject(value) &&
    typeof (value as { mediaType?: unknown }).mediaType === 'string' &&
    typeof (value as { scene?: unknown }).scene === 'string' &&
    typeof (value as { provider?: unknown }).provider === 'string' &&
    typeof (value as { model?: unknown }).model === 'string' &&
    typeof (value as { label?: unknown }).label === 'string' &&
    typeof (value as { costCredits?: unknown }).costCredits === 'number' &&
    typeof (value as { isDefault?: unknown }).isDefault === 'boolean'
  );
}

function isCapabilitiesPayload(
  value: unknown
): value is { capabilities: AICapability[] } {
  return (
    isPlainObject(value) &&
    Array.isArray((value as { capabilities?: unknown }).capabilities) &&
    (value as { capabilities: unknown[] }).capabilities.every(isAICapability)
  );
}

export function isAIGenerationTaskResponse(
  value: unknown
): value is AIGenerationTaskResponse {
  return (
    isPlainObject(value) &&
    typeof (value as { id?: unknown }).id === 'string' &&
    typeof (value as { status?: unknown }).status === 'string' &&
    typeof (value as { provider?: unknown }).provider === 'string' &&
    (typeof (value as { model?: unknown }).model === 'string' ||
      (value as { model?: unknown }).model === null) &&
    (typeof (value as { prompt?: unknown }).prompt === 'string' ||
      (value as { prompt?: unknown }).prompt === null) &&
    (isPlainObject((value as { taskInfo?: unknown }).taskInfo) ||
      (value as { taskInfo?: unknown }).taskInfo === null)
  );
}

function getTaskErrorMessage(task: AIGenerationTaskResponse) {
  const taskInfo = task.taskInfo;
  if (!taskInfo) {
    return undefined;
  }

  const errorMessage = taskInfo.errorMessage;
  return typeof errorMessage === 'string' && errorMessage.trim()
    ? errorMessage
    : undefined;
}

function getCurrentCallbackUrl(): string {
  if (typeof window === 'undefined') {
    return '/';
  }

  return (
    `${window.location.pathname}${window.location.search}${window.location.hash}` ||
    '/'
  );
}

export function buildAiSignInUrl({
  callbackUrl,
  locale,
}: {
  callbackUrl: string;
  locale: string;
}): string {
  return localizeCallbackUrl({
    callbackUrl: withCallbackUrl('/sign-in', callbackUrl),
    locale,
    defaultLocale,
  });
}

export function useAiGenerationController<
  TFormState,
  TPayload extends Record<string, unknown> | null = Record<
    string,
    unknown
  > | null,
>({
  mediaType,
  initialSelection,
  buildRequestBody,
  adapter,
  messages,
  locale,
}: UseAiGenerationControllerOptions<TFormState, TPayload>) {
  const resolvedLocale = locale || defaultLocale;
  const { setIsShowSignModal, authSettings } = usePublicAppContext();
  const canOpenInlineSignModal =
    authSettings.emailAuthEnabled ||
    authSettings.googleAuthEnabled ||
    authSettings.githubAuthEnabled;
  const {
    data: details,
    error: detailsError,
    isLoading: isLoadingDetails,
    refresh: refreshDetails,
  } = useSelfUserDetails({ enabled: true });

  const [capabilities, setCapabilities] = useState<AICapability[]>([]);
  const [capabilityError, setCapabilityError] = useState<unknown>(null);
  const [isLoadingCapabilities, setIsLoadingCapabilities] = useState(true);
  const [scene, setSceneState] = useState(initialSelection?.scene ?? '');
  const [provider, setProviderState] = useState(
    initialSelection?.provider ?? ''
  );
  const [model, setModelState] = useState(initialSelection?.model ?? '');
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [taskStatus, setTaskStatus] = useState<AITaskStatus | null>(null);

  const mediaCapabilities = useMemo(
    () =>
      capabilities.filter((capability) => capability.mediaType === mediaType),
    [capabilities, mediaType]
  );

  const resolvedSelection = useMemo(
    () =>
      resolveAICapabilitySelection(mediaCapabilities, {
        scene,
        provider,
        model,
      }),
    [mediaCapabilities, model, provider, scene]
  );

  useEffect(() => {
    let cancelled = false;

    const loadCapabilities = async () => {
      setIsLoadingCapabilities(true);
      setCapabilityError(null);

      try {
        const data = await fetchJson<{ capabilities: AICapability[] }>(
          '/api/ai/capabilities',
          { method: 'GET' },
          {
            validate: isCapabilitiesPayload,
            invalidDataMessage: messages.loadCapabilitiesFailed,
          }
        );

        if (cancelled) {
          return;
        }

        setCapabilities(data.capabilities);
      } catch (error) {
        if (cancelled) {
          return;
        }

        setCapabilities([]);
        setCapabilityError(error);
      } finally {
        if (!cancelled) {
          setIsLoadingCapabilities(false);
        }
      }
    };

    void loadCapabilities();

    return () => {
      cancelled = true;
    };
  }, [messages.loadCapabilitiesFailed]);

  const accountErrorMessage = useMemo(() => {
    if (!detailsError) {
      return null;
    }

    return formatMessageWithRequestId(
      messages.loadAccountDetailsFailed,
      getRequestIdFromError(detailsError)
    );
  }, [detailsError, messages.loadAccountDetailsFailed]);

  const promptSignIn = useCallback(() => {
    if (canOpenInlineSignModal) {
      setIsShowSignModal(true);
      return;
    }

    window.location.assign(
      buildAiSignInUrl({
        callbackUrl: getCurrentCallbackUrl(),
        locale: resolvedLocale,
      })
    );
  }, [canOpenInlineSignModal, resolvedLocale, setIsShowSignModal]);

  const capabilityErrorMessage = useMemo(() => {
    if (!capabilityError) {
      return null;
    }

    return formatMessageWithRequestId(
      messages.loadCapabilitiesFailed,
      getRequestIdFromError(capabilityError)
    );
  }, [capabilityError, messages.loadCapabilitiesFailed]);

  const refreshDetailsSafely = useCallback(async () => {
    try {
      await refreshDetails();
    } catch (error) {
      if (error instanceof RequestIdError && error.status === 401) {
        promptSignIn();
        return;
      }

      toastFetchError(error, messages.refreshAccountDetailsFailed);
    }
  }, [messages.refreshAccountDetailsFailed, promptSignIn, refreshDetails]);

  const resolveDetailsForGenerate = useCallback(async () => {
    const result = await resolveSelfUserDetailsForAction({
      currentDetails: details,
      loadDetails: refreshDetails,
    });

    if (result.status === 'auth_required') {
      promptSignIn();
      return null;
    }

    if (result.status === 'error') {
      toastFetchError(result.error, messages.loadAccountDetailsFailed);
      return null;
    }

    return result.details;
  }, [
    details,
    messages.loadAccountDetailsFailed,
    promptSignIn,
    refreshDetails,
  ]);

  const { ensureCredits } = useCreditsGate({
    resolveDetails: resolveDetailsForGenerate,
  });

  const reset = useCallback(() => {
    setIsGenerating(false);
    setProgress(0);
    setTaskId(null);
    setTaskStatus(null);
  }, []);

  const finishTask = useCallback((status: AITaskStatus) => {
    setIsGenerating(false);
    setTaskId(null);
    setTaskStatus(status);
  }, []);

  const pollTaskStatus = useCallback(
    async (currentTaskId: string) => {
      const helpers = { setProgress };

      try {
        const task = await fetchJson<AIGenerationTaskResponse>(
          '/api/ai/query',
          { method: 'POST', body: { taskId: currentTaskId } },
          {
            validate: isAIGenerationTaskResponse,
            invalidDataMessage: messages.queryTaskFailed,
          }
        );

        const currentStatus = task.status as AITaskStatus;
        const payload = (
          adapter?.parsePollingPayload
            ? adapter.parsePollingPayload(task)
            : task.taskInfo
        ) as TPayload;
        const context = {
          task,
          payload,
          helpers,
        };
        setTaskStatus(currentStatus);

        if (currentStatus === AITaskStatus.PENDING) {
          adapter?.handlePending?.(context);
          if (!adapter?.handlePending) {
            setProgress((prev) => Math.max(prev, 20));
          }
          return { done: false as const };
        }

        if (currentStatus === AITaskStatus.PROCESSING) {
          adapter?.handleProcessing?.(context);
          if (!adapter?.handleProcessing) {
            setProgress((prev) => Math.min(prev + 5, 80));
          }
          return { done: false as const };
        }

        if (currentStatus === AITaskStatus.SUCCESS) {
          adapter?.handleSuccess?.(context);
          setProgress(100);
          finishTask(AITaskStatus.SUCCESS);
          void refreshDetailsSafely();
          return { done: true as const, terminalState: 'success' as const };
        }

        if (currentStatus === AITaskStatus.FAILED) {
          const errorMessage =
            adapter?.handleFailed?.(context) ||
            getTaskErrorMessage(task) ||
            messages.queryTaskFailedWithReason(messages.unknownError);
          toast.error(errorMessage);
          finishTask(AITaskStatus.FAILED);
          void refreshDetailsSafely();
          return { done: true as const, terminalState: 'failed' as const };
        }

        setProgress((prev) => Math.min(prev + 5, 95));
        return { done: false as const };
      } catch (error) {
        finishTask(AITaskStatus.FAILED);
        toastFetchError(
          error,
          messages.queryTaskFailedWithReason(
            error instanceof Error && error.message
              ? error.message
              : messages.unknownError
          )
        );
        void refreshDetailsSafely();
        return { done: true as const, terminalState: 'failed' as const };
      }
    },
    [adapter, finishTask, messages, refreshDetailsSafely]
  );

  useAIGenerationTask({
    taskId,
    enabled: isGenerating,
    pollIntervalMs: adapter?.pollIntervalMs ?? 5000,
    timeoutMs: adapter?.timeoutMs ?? 180000,
    onPoll: pollTaskStatus,
    onTimeout: () => {
      finishTask(AITaskStatus.FAILED);
      setProgress(0);
      toast.error(messages.timeout);
    },
  });

  const run = useCallback(
    async (formState: TFormState) => {
      if (!resolvedSelection.capability) {
        toast.error(capabilityErrorMessage || messages.invalidProviderOrModel);
        return false;
      }

      const nextDetails = await ensureCredits({
        requiredCredits: resolvedSelection.capability.costCredits,
        insufficientCreditsMessage: messages.insufficientCredits,
      });
      if (!nextDetails) {
        return false;
      }

      adapter?.onStart?.();
      setIsGenerating(true);
      setTaskStatus(AITaskStatus.PENDING);
      setProgress(adapter?.initialProgress ?? 10);

      try {
        const body = buildRequestBody({
          formState,
          capability: resolvedSelection.capability,
        });

        const data = await fetchJson<{ id: string }>(
          '/api/ai/generate',
          {
            method: 'POST',
            body,
          },
          {
            validate: (value): value is { id: string } =>
              isPlainObject(value) &&
              typeof (value as { id?: unknown }).id === 'string' &&
              Boolean((value as { id: string }).id.trim()),
            invalidDataMessage: messages.createTaskFailed,
          }
        );

        setTaskId(data.id.trim());
        setProgress((adapter?.initialProgress ?? 10) + 10);
        await refreshDetailsSafely();
        return true;
      } catch (error) {
        reset();
        toastFetchError(
          error,
          messages.createTaskFailedWithReason(
            error instanceof Error && error.message
              ? error.message
              : messages.unknownError
          )
        );
        return false;
      }
    },
    [
      adapter,
      buildRequestBody,
      capabilityErrorMessage,
      ensureCredits,
      messages,
      refreshDetailsSafely,
      reset,
      resolvedSelection.capability,
    ]
  );

  return {
    details: details as SelfUserDetails | null,
    remainingCredits: details?.credits?.remainingCredits ?? 0,
    costCredits: resolvedSelection.capability?.costCredits ?? 0,
    capabilities: mediaCapabilities,
    scene: resolvedSelection.scene,
    provider: resolvedSelection.provider,
    model: resolvedSelection.model,
    setScene: (nextScene: string) => {
      setSceneState(nextScene);
      setProviderState('');
      setModelState('');
    },
    setProvider: (nextProvider: string) => {
      setProviderState(nextProvider);
      setModelState('');
    },
    setModel: setModelState,
    selectedCapability: resolvedSelection.capability,
    isLoadingCapabilities,
    isLoadingDetails,
    accountErrorMessage,
    capabilityErrorMessage,
    isGenerating,
    progress,
    taskId,
    taskStatus,
    run,
    reset,
    refreshDetails: refreshDetailsSafely,
  };
}
