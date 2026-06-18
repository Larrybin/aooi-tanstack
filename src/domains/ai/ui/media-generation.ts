import type {
  AIGenerationTaskAdapter,
  AIGenerationTaskResponse,
} from '@/domains/ai/ui/use-ai-generation-controller';

import type { AISong } from '@/extensions/ai';
import type { AICapability } from '@/shared/types/ai-capability';

export type AIGenerationSelectOption = {
  value: string;
  label: string;
};

export type AIGenerationControllerMessageInput = {
  invalidProviderOrModel: string;
  insufficientCredits: string;
  createTaskFailed: string;
  queryTaskFailed: string;
  timeout: string;
  unknownError: string;
  createTaskFailedWithReason: (reason: string) => string;
  queryTaskFailedWithReason: (reason: string) => string;
};

export type GeneratedImage = {
  id: string;
  url: string;
  provider?: string;
  model?: string;
  prompt?: string;
};

export type GeneratedSong = {
  id: string;
  title: string;
  duration: number;
  audioUrl: string;
  imageUrl?: string;
  artist: string;
  style: string;
  status: string;
  prompt?: string;
};

export type ImageTaskInfo = Record<string, unknown> & {
  images?: Array<
    | {
        imageUrl?: string;
        url?: string;
      }
    | string
    | null
    | undefined
  >;
  errorMessage?: string;
};

export type MusicTaskInfo = Record<string, unknown> & {
  songs?: AISong[];
  errorMessage?: string;
};

export function buildAIGenerationControllerMessages({
  invalidProviderOrModel,
  insufficientCredits,
  createTaskFailed,
  queryTaskFailed,
  timeout,
  unknownError,
  createTaskFailedWithReason,
  queryTaskFailedWithReason,
}: AIGenerationControllerMessageInput) {
  return {
    loadAccountDetailsFailed: 'Failed to load account details',
    refreshAccountDetailsFailed: 'Failed to refresh account details',
    loadCapabilitiesFailed: 'Failed to load AI capabilities',
    invalidProviderOrModel,
    insufficientCredits,
    createTaskFailed,
    queryTaskFailed,
    timeout,
    unknownError,
    createTaskFailedWithReason,
    queryTaskFailedWithReason,
  };
}

export function buildAIGenerationSelectState(
  capabilities: AICapability[],
  scene: string,
  provider: string
) {
  const sceneOptions = Array.from(
    new Set(capabilities.map((capability) => capability.scene))
  );

  const providerOptions = Array.from(
    new Set(
      capabilities
        .filter((capability) => capability.scene === scene)
        .map((capability) => capability.provider)
    )
  ).map((value): AIGenerationSelectOption => ({ value, label: value }));

  const modelOptions = capabilities
    .filter(
      (capability) =>
        capability.scene === scene && capability.provider === provider
    )
    .map(
      (capability): AIGenerationSelectOption => ({
        value: capability.model,
        label: capability.label,
      })
    );

  return {
    sceneOptions,
    providerOptions,
    modelOptions,
  };
}

export function extractImageUrlsFromTaskInfo(
  taskInfo: ImageTaskInfo | null
): string[] {
  if (!taskInfo?.images || !Array.isArray(taskInfo.images)) {
    return [];
  }

  return taskInfo.images
    .map((image) => {
      if (!image) return undefined;
      if (typeof image === 'string') return image;
      if (typeof image === 'object') {
        if (typeof image.imageUrl === 'string') return image.imageUrl;
        if (typeof image.url === 'string') return image.url;
      }
      return undefined;
    })
    .filter((url): url is string => Boolean(url));
}

export function toGeneratedImages(
  task: AIGenerationTaskResponse,
  imageUrls: string[]
): GeneratedImage[] {
  return imageUrls.map((url, index) => ({
    id: `${task.id}-${index}`,
    url,
    provider: task.provider,
    model: task.model ?? undefined,
    prompt: task.prompt ?? undefined,
  }));
}

export function toGeneratedSongs(songs: AISong[]): GeneratedSong[] {
  return songs.map((song) => ({
    id: song.id ?? '',
    title: song.title ?? '',
    duration: song.duration,
    audioUrl: song.audioUrl,
    imageUrl: song.imageUrl ?? '',
    artist: song.artist ?? '',
    style: song.style ?? '',
    status: '',
    prompt: song.prompt,
  }));
}

function getTaskErrorMessage(
  payload: { errorMessage?: unknown } | null | undefined
) {
  const errorMessage = payload?.errorMessage;
  return typeof errorMessage === 'string' && errorMessage.trim()
    ? errorMessage
    : undefined;
}

export function createImageGenerationTaskAdapter({
  clearGeneratedImages,
  setGeneratedImages,
  onEmptySuccess,
  onSuccess,
  failedFallbackMessage,
}: {
  clearGeneratedImages: () => void;
  setGeneratedImages: (images: GeneratedImage[]) => void;
  onEmptySuccess: () => void;
  onSuccess: () => void;
  failedFallbackMessage: string;
}): AIGenerationTaskAdapter<ImageTaskInfo | null> {
  return {
    initialProgress: 15,
    pollIntervalMs: 5000,
    timeoutMs: 180000,
    parsePollingPayload: (task) => task.taskInfo as ImageTaskInfo | null,
    onStart: clearGeneratedImages,
    handlePending: ({ helpers: { setProgress } }) => {
      setProgress((prev) => Math.max(prev, 20));
    },
    handleProcessing: ({ task, payload, helpers: { setProgress } }) => {
      const imageUrls = extractImageUrlsFromTaskInfo(payload);

      if (imageUrls.length > 0) {
        setGeneratedImages(toGeneratedImages(task, imageUrls));
        setProgress((prev) => Math.max(prev, 85));
        return;
      }

      setProgress((prev) => Math.min(prev + 10, 80));
    },
    handleSuccess: ({ task, payload }) => {
      const imageUrls = extractImageUrlsFromTaskInfo(payload);

      if (imageUrls.length === 0) {
        onEmptySuccess();
        return;
      }

      setGeneratedImages(toGeneratedImages(task, imageUrls));
      onSuccess();
    },
    handleFailed: ({ payload }) =>
      getTaskErrorMessage(payload) || failedFallbackMessage,
  };
}

export function createMusicGenerationTaskAdapter({
  clearGeneratedSongs,
  setGeneratedSongs,
  formatFailedReason,
  unknownErrorMessage,
}: {
  clearGeneratedSongs: () => void;
  setGeneratedSongs: (songs: GeneratedSong[]) => void;
  formatFailedReason: (reason: string) => string;
  unknownErrorMessage: string;
}): AIGenerationTaskAdapter<MusicTaskInfo | null> {
  return {
    initialProgress: 10,
    pollIntervalMs: 10000,
    timeoutMs: 180000,
    parsePollingPayload: (task) => task.taskInfo as MusicTaskInfo | null,
    onStart: clearGeneratedSongs,
    handlePending: ({ helpers: { setProgress } }) => {
      setProgress(10);
    },
    handleProcessing: ({ payload, helpers: { setProgress } }) => {
      const songs = Array.isArray(payload?.songs) ? payload.songs : [];

      if (songs.length === 0) {
        setProgress((prev) => Math.min(prev + 3, 80));
        return;
      }

      setGeneratedSongs(toGeneratedSongs(songs));

      if (songs.some((song) => !!song.audioUrl)) {
        setProgress(85);
        return;
      }

      if (songs.some((song) => !!song.imageUrl)) {
        setProgress(60);
        return;
      }

      setProgress(20);
    },
    handleSuccess: ({ payload }) => {
      const songs = Array.isArray(payload?.songs) ? payload.songs : [];
      setGeneratedSongs(toGeneratedSongs(songs));
    },
    handleFailed: ({ payload }) =>
      formatFailedReason(getTaskErrorMessage(payload) || unknownErrorMessage),
  };
}
