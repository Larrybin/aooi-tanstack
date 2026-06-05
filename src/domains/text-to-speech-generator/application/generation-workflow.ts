import type { StorageService } from '@/infra/adapters/storage/service-builder';

import { getUuid } from '@/shared/lib/hash';

import {
  buildTextToSpeechTextPreview,
  getTextToSpeechHistoryLimit,
  serializeTextToSpeechGenerationForClient,
  type TextToSpeechGenerationRecord,
} from '../domain/history';
import {
  addTextToSpeechRetentionDays,
  resolveTextToSpeechPlanLimits,
} from '../domain/plan';
import {
  resolveTextToSpeechPreviewRequest,
  type ResolvedTextToSpeechPreviewRequest,
} from '../domain/request';
import type { TextToSpeechActor } from '../domain/types';
import {
  generateTextToSpeechPreview,
  type GenerateTextToSpeechPreviewInput,
  type GenerateTextToSpeechPreviewResult,
  type TextToSpeechProvider,
  type TextToSpeechSynthesisResult,
} from './generate-preview';

type StorageDeps = Pick<StorageService, 'uploadFile' | 'getFile'>;

export type GenerateStoredTextToSpeechDeps = {
  provider: TextToSpeechProvider;
  getStorageService: () => Promise<StorageDeps>;
  findReusableGeneration: (input: {
    userId: string | null;
    anonymousSessionId: string | null;
    requestHash: string;
    now: Date;
  }) => Promise<TextToSpeechGenerationRecord | undefined>;
  createGeneration: (input: {
    id: string;
    userId: string | null;
    anonymousSessionId: string | null;
    status: 'generated';
    textPreview: string;
    characterCount: number;
    language: string;
    voice: string;
    model: string;
    outputFormat: string;
    requestHash: string;
    storageKey: string;
    mimeType: string;
    byteSize: number;
    expiresAt: Date;
  }) => Promise<TextToSpeechGenerationRecord>;
  deleteOverflowGenerations: (input: {
    userId: string | null;
    anonymousSessionId: string | null;
    keep: number;
  }) => Promise<unknown>;
  createId?: () => string;
  now?: () => Date;
};

function actorOwner(actor: TextToSpeechActor) {
  return {
    userId: actor.kind === 'user' ? actor.userId : null,
    anonymousSessionId: actor.anonymousSessionId ?? null,
  };
}

function audioBase64ToBytes(audioBase64: string): Uint8Array {
  return Uint8Array.from(Buffer.from(audioBase64, 'base64'));
}

async function streamToBase64(stream: ReadableStream<Uint8Array>) {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      total += value.byteLength;
    }
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return Buffer.from(bytes).toString('base64');
}

function buildStorageKey({
  id,
  request,
}: {
  id: string;
  request: ResolvedTextToSpeechPreviewRequest;
}) {
  return `text-to-speech-generator/${request.language}/${id}.mp3`;
}

async function readStoredAudio({
  storage,
  generation,
}: {
  storage: Pick<StorageDeps, 'getFile'>;
  generation: TextToSpeechGenerationRecord;
}): Promise<TextToSpeechSynthesisResult | null> {
  const file = await storage.getFile(generation.storageKey);
  if (!file?.body) {
    return null;
  }

  return {
    audioBase64: await streamToBase64(file.body),
    contentType: 'audio/mpeg',
  };
}

function toStoredPreviewResult({
  audio,
  request,
  generation,
  reused,
}: {
  audio: TextToSpeechSynthesisResult;
  request: ResolvedTextToSpeechPreviewRequest;
  generation: TextToSpeechGenerationRecord;
  reused: boolean;
}): GenerateTextToSpeechPreviewResult {
  return {
    audio,
    request: {
      characters: request.characters,
      language: request.language,
      voice: request.voice.id,
      model: request.modelId,
      outputFormat: request.outputFormat,
      hash: request.requestHash,
    },
    generation: {
      id: generation.id,
      textPreview: generation.textPreview,
      expiresAt: generation.expiresAt,
      reused,
    },
    warnings: [
      'Playback speed only changes the browser player speed; the generated MP3 is not speed-adjusted.',
    ],
  };
}

export async function generateStoredTextToSpeechPreview({
  actor,
  input,
  deps,
}: {
  actor: TextToSpeechActor;
  input: Omit<GenerateTextToSpeechPreviewInput, 'actorKind'>;
  deps: GenerateStoredTextToSpeechDeps;
}): Promise<GenerateTextToSpeechPreviewResult & { history: unknown[] }> {
  const now = (deps.now ?? (() => new Date()))();
  const request = resolveTextToSpeechPreviewRequest({
    ...input,
    actorKind: actor.kind === 'user' ? 'user' : 'guest',
  });
  const owner = actorOwner(actor);
  const storage = await deps.getStorageService();
  const reusable = await deps.findReusableGeneration({
    ...owner,
    requestHash: request.requestHash,
    now,
  });
  if (reusable) {
    const storedAudio = await readStoredAudio({
      storage,
      generation: reusable,
    });
    if (storedAudio) {
      return {
        ...toStoredPreviewResult({
          audio: storedAudio,
          request,
          generation: reusable,
          reused: true,
        }),
        history: [
          serializeTextToSpeechGenerationForClient({
            actor,
            generation: reusable,
            now,
          }),
        ],
      };
    }
  }

  const preview = await generateTextToSpeechPreview({
    input: {
      ...input,
      actorKind: actor.kind === 'user' ? 'user' : 'guest',
    },
    provider: deps.provider,
  });
  const id = (deps.createId ?? getUuid)();
  const audioBytes = audioBase64ToBytes(preview.audio.audioBase64);
  const storageKey = buildStorageKey({ id, request });
  const upload = await storage.uploadFile({
    body: audioBytes,
    key: storageKey,
    contentType: preview.audio.contentType,
    disposition: 'inline',
  });
  if (!upload.success || !upload.key) {
    throw new Error(upload.error || 'tts audio upload failed');
  }

  const plan = resolveTextToSpeechPlanLimits(actor);
  const created = await deps.createGeneration({
    id,
    ...owner,
    status: 'generated',
    textPreview: buildTextToSpeechTextPreview(request.text),
    characterCount: request.characters,
    language: request.language,
    voice: request.voice.id,
    model: request.modelId,
    outputFormat: request.outputFormat,
    requestHash: request.requestHash,
    storageKey: upload.key,
    mimeType: preview.audio.contentType,
    byteSize: audioBytes.byteLength,
    expiresAt: addTextToSpeechRetentionDays(now, plan.retentionDays),
  });
  await deps.deleteOverflowGenerations({
    ...owner,
    keep: getTextToSpeechHistoryLimit(actor),
  });

  return {
    ...toStoredPreviewResult({
      audio: preview.audio,
      request,
      generation: created,
      reused: false,
    }),
    history: [
      serializeTextToSpeechGenerationForClient({
        actor,
        generation: created,
        now,
      }),
    ],
  };
}
