import assert from 'node:assert/strict';
import test from 'node:test';

import { AIMediaType, type AISong } from '@/extensions/ai';
import type { AICapability } from '@/shared/types/ai-capability';

import {
  buildAIGenerationControllerMessages,
  buildAIGenerationSelectState,
  createImageGenerationTaskAdapter,
  createMusicGenerationTaskAdapter,
  extractImageUrlsFromTaskInfo,
  toGeneratedSongs,
  type GeneratedImage,
  type GeneratedSong,
} from './media-generation';
import type { AIGenerationTaskResponse } from './use-ai-generation-controller';

const task: AIGenerationTaskResponse = {
  id: 'task_1',
  status: 'processing',
  provider: 'replicate',
  model: 'model-a',
  prompt: 'prompt',
  taskInfo: null,
};

function createProgressRecorder(initial: number) {
  let progress = initial;
  return {
    get value() {
      return progress;
    },
    setProgress: (next: number | ((prev: number) => number)) => {
      progress = typeof next === 'function' ? next(progress) : next;
    },
  };
}

function capability(
  scene: string,
  provider: string,
  model: string,
  label = model
): AICapability {
  return {
    mediaType: AIMediaType.IMAGE,
    scene,
    provider,
    model,
    label,
    costCredits: 1,
    isDefault: false,
  };
}

test('buildAIGenerationSelectState: 推导 scene/provider/model 选项', () => {
  const result = buildAIGenerationSelectState(
    [
      capability('text-to-image', 'replicate', 'flux', 'Flux'),
      capability('text-to-image', 'replicate', 'nano', 'Nano'),
      capability('text-to-image', 'other', 'other-model', 'Other'),
      capability('image-to-image', 'replicate', 'edit', 'Edit'),
    ],
    'text-to-image',
    'replicate'
  );

  assert.deepEqual(result.sceneOptions, ['text-to-image', 'image-to-image']);
  assert.deepEqual(result.providerOptions, [
    { value: 'replicate', label: 'replicate' },
    { value: 'other', label: 'other' },
  ]);
  assert.deepEqual(result.modelOptions, [
    { value: 'flux', label: 'Flux' },
    { value: 'nano', label: 'Nano' },
  ]);
});

test('buildAIGenerationControllerMessages: 统一 controller 文案结构', () => {
  const messages = buildAIGenerationControllerMessages({
    invalidProviderOrModel: 'invalid',
    insufficientCredits: 'credits',
    createTaskFailed: 'create',
    queryTaskFailed: 'query',
    timeout: 'timeout',
    unknownError: 'unknown',
    createTaskFailedWithReason: (reason) => `create: ${reason}`,
    queryTaskFailedWithReason: (reason) => `query: ${reason}`,
  });

  assert.equal(
    messages.loadAccountDetailsFailed,
    'Failed to load account details'
  );
  assert.equal(
    messages.refreshAccountDetailsFailed,
    'Failed to refresh account details'
  );
  assert.equal(
    messages.loadCapabilitiesFailed,
    'Failed to load AI capabilities'
  );
  assert.equal(messages.createTaskFailedWithReason('bad'), 'create: bad');
  assert.equal(messages.queryTaskFailedWithReason('bad'), 'query: bad');
});

test('extractImageUrlsFromTaskInfo: 支持 string、imageUrl、url 并过滤无效值', () => {
  assert.deepEqual(
    extractImageUrlsFromTaskInfo({
      images: [
        'https://example.com/a.png',
        { imageUrl: 'https://example.com/b.png' },
        { url: 'https://example.com/c.png' },
        null,
        undefined,
        { imageUrl: '' },
        {},
      ],
    }),
    [
      'https://example.com/a.png',
      'https://example.com/b.png',
      'https://example.com/c.png',
    ]
  );
  assert.deepEqual(extractImageUrlsFromTaskInfo(null), []);
});

test('createImageGenerationTaskAdapter: 覆盖 pending/processing/success/failed 分支', () => {
  const images: GeneratedImage[][] = [];
  let emptySuccessCalls = 0;
  let successCalls = 0;
  let clearCalls = 0;

  const adapter = createImageGenerationTaskAdapter({
    clearGeneratedImages: () => {
      clearCalls += 1;
    },
    setGeneratedImages: (nextImages) => {
      images.push(nextImages);
    },
    onEmptySuccess: () => {
      emptySuccessCalls += 1;
    },
    onSuccess: () => {
      successCalls += 1;
    },
    failedFallbackMessage: 'generate failed',
  });

  adapter.onStart?.();
  assert.equal(clearCalls, 1);

  const pendingProgress = createProgressRecorder(5);
  adapter.handlePending?.({
    task,
    payload: null,
    helpers: { setProgress: pendingProgress.setProgress },
  });
  assert.equal(pendingProgress.value, 20);

  const processingProgress = createProgressRecorder(10);
  adapter.handleProcessing?.({
    task,
    payload: { images: [{ imageUrl: 'https://example.com/a.png' }] },
    helpers: { setProgress: processingProgress.setProgress },
  });
  assert.equal(processingProgress.value, 85);
  assert.deepEqual(images.at(-1), [
    {
      id: 'task_1-0',
      url: 'https://example.com/a.png',
      provider: 'replicate',
      model: 'model-a',
      prompt: 'prompt',
    },
  ]);

  const emptyProcessingProgress = createProgressRecorder(75);
  adapter.handleProcessing?.({
    task,
    payload: { images: [] },
    helpers: { setProgress: emptyProcessingProgress.setProgress },
  });
  assert.equal(emptyProcessingProgress.value, 80);

  adapter.handleSuccess?.({
    task,
    payload: { images: [] },
    helpers: { setProgress: createProgressRecorder(0).setProgress },
  });
  assert.equal(emptySuccessCalls, 1);
  assert.equal(successCalls, 0);

  adapter.handleSuccess?.({
    task,
    payload: { images: ['https://example.com/success.png'] },
    helpers: { setProgress: createProgressRecorder(0).setProgress },
  });
  assert.equal(successCalls, 1);
  assert.equal(
    adapter.handleFailed?.({
      task,
      payload: { errorMessage: 'provider failed' },
      helpers: { setProgress: createProgressRecorder(0).setProgress },
    }),
    'provider failed'
  );
  assert.equal(
    adapter.handleFailed?.({
      task,
      payload: { errorMessage: '   ' },
      helpers: { setProgress: createProgressRecorder(0).setProgress },
    }),
    'generate failed'
  );
});

test('toGeneratedSongs: 对缺失可选字段保持组件原默认值', () => {
  const songs: AISong[] = [
    {
      audioUrl: 'https://example.com/song.mp3',
      duration: 120,
      prompt: 'prompt',
      title: 'title',
      tags: '',
    } as AISong,
  ];

  assert.deepEqual(toGeneratedSongs(songs), [
    {
      id: '',
      title: 'title',
      duration: 120,
      audioUrl: 'https://example.com/song.mp3',
      imageUrl: '',
      artist: '',
      style: '',
      status: '',
      prompt: 'prompt',
    },
  ]);
});

test('createMusicGenerationTaskAdapter: 覆盖 pending/processing/success/failed 分支', () => {
  const generatedSongs: GeneratedSong[][] = [];
  let clearCalls = 0;
  const adapter = createMusicGenerationTaskAdapter({
    clearGeneratedSongs: () => {
      clearCalls += 1;
    },
    setGeneratedSongs: (songs) => {
      generatedSongs.push(songs);
    },
    formatFailedReason: (reason) => `failed: ${reason}`,
    unknownErrorMessage: 'unknown',
  });

  adapter.onStart?.();
  assert.equal(clearCalls, 1);

  const pendingProgress = createProgressRecorder(55);
  adapter.handlePending?.({
    task,
    payload: null,
    helpers: { setProgress: pendingProgress.setProgress },
  });
  assert.equal(pendingProgress.value, 10);

  const noSongProgress = createProgressRecorder(78);
  adapter.handleProcessing?.({
    task,
    payload: { songs: [] },
    helpers: { setProgress: noSongProgress.setProgress },
  });
  assert.equal(noSongProgress.value, 80);

  const imageOnlyProgress = createProgressRecorder(0);
  adapter.handleProcessing?.({
    task,
    payload: {
      songs: [
        {
          imageUrl: 'https://example.com/cover.png',
          duration: 1,
          prompt: '',
          title: '',
          tags: '',
          style: '',
          audioUrl: '',
        },
      ],
    },
    helpers: { setProgress: imageOnlyProgress.setProgress },
  });
  assert.equal(imageOnlyProgress.value, 60);

  const audioProgress = createProgressRecorder(0);
  adapter.handleProcessing?.({
    task,
    payload: {
      songs: [
        {
          audioUrl: 'https://example.com/song.mp3',
          imageUrl: '',
          duration: 1,
          prompt: '',
          title: 'Song',
          tags: '',
          style: 'pop',
        },
      ],
    },
    helpers: { setProgress: audioProgress.setProgress },
  });
  assert.equal(audioProgress.value, 85);
  assert.equal(generatedSongs.at(-1)?.[0]?.title, 'Song');

  adapter.handleSuccess?.({
    task,
    payload: { songs: [] },
    helpers: { setProgress: createProgressRecorder(0).setProgress },
  });
  assert.deepEqual(generatedSongs.at(-1), []);
  assert.equal(
    adapter.handleFailed?.({
      task,
      payload: { errorMessage: 'provider failed' },
      helpers: { setProgress: createProgressRecorder(0).setProgress },
    }),
    'failed: provider failed'
  );
  assert.equal(
    adapter.handleFailed?.({
      task,
      payload: null,
      helpers: { setProgress: createProgressRecorder(0).setProgress },
    }),
    'failed: unknown'
  );
});
