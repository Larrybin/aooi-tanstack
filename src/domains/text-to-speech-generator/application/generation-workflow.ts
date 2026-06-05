import type { StorageService } from '@/infra/adapters/storage/service-builder';

import { ForbiddenError } from '@/shared/lib/api/errors';
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
  addTextToSpeechQuotaReservationMinutes,
  getTextToSpeechQuotaWindowStart,
  TEXT_TO_SPEECH_QUOTA_OPERATION_KEYS,
} from '../domain/quota';
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

type StorageDeps = Pick<
  StorageService,
  'uploadFile' | 'getFile' | 'deleteFiles'
>;

type TextToSpeechGenerationCharge = {
  quotaReservationId: string | null;
  creditId: string | null;
  chargedCharacters: number;
  monthlyQuotaCharacters: number;
  extraCreditCharacters: number;
};

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
    quotaReservationId: string | null;
    creditId: string | null;
    chargedCharacters: number;
    monthlyQuotaCharacters: number;
    extraCreditCharacters: number;
    expiresAt: Date;
  }) => Promise<TextToSpeechGenerationRecord>;
  markGenerationDeleted: (input: { id: string; now: Date }) => Promise<unknown>;
  deleteOverflowGenerations: (input: {
    userId: string | null;
    anonymousSessionId: string | null;
    keep: number;
  }) => Promise<unknown>;
  countMonthlyQuotaUnits: (input: {
    userId: string;
    windowStart: Date;
    now: Date;
  }) => Promise<number>;
  reserveMonthlyQuota: (input: {
    actor: TextToSpeechActor;
    productId: string;
    operationKey: 'speech.generate';
    units: number;
    limit: number;
    windowStart: Date;
    idempotencyKey: string;
    expiresAt: Date;
    reason?: string | null;
    entitlementGrantIdsJson?: string | null;
    now: Date;
  }) => Promise<{ reservation: { id: string } }>;
  commitMonthlyQuota: (input: {
    reservationId: string;
    now: Date;
  }) => Promise<unknown>;
  refundMonthlyQuota: (input: {
    reservationId: string;
    reason?: string;
    now: Date;
  }) => Promise<unknown>;
  consumeCredits: (input: {
    userId: string;
    credits: number;
    scene: string;
    description: string;
    metadata: string;
  }) => Promise<{ id: string }>;
  refundConsumedCredit: (creditId: string) => Promise<unknown>;
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

function formatEntitlementGrantIdsJson(actor: TextToSpeechActor) {
  if (actor.kind !== 'user' || !actor.entitlementGrantIds?.length) {
    return null;
  }

  return JSON.stringify(actor.entitlementGrantIds);
}

async function reserveGenerationCharge({
  actor,
  generationId,
  characters,
  requestHash,
  now,
  deps,
}: {
  actor: TextToSpeechActor;
  generationId: string;
  characters: number;
  requestHash: string;
  now: Date;
  deps: GenerateStoredTextToSpeechDeps;
}): Promise<TextToSpeechGenerationCharge> {
  if (actor.kind !== 'user') {
    return {
      quotaReservationId: null,
      creditId: null,
      chargedCharacters: 0,
      monthlyQuotaCharacters: 0,
      extraCreditCharacters: 0,
    };
  }

  const plan = resolveTextToSpeechPlanLimits(actor);
  const windowStart = getTextToSpeechQuotaWindowStart(now);
  const usedMonthlyCharacters = await deps.countMonthlyQuotaUnits({
    userId: actor.userId,
    windowStart,
    now,
  });
  const monthlyQuotaCharacters = Math.min(
    characters,
    Math.max(0, plan.monthlyCharacters - usedMonthlyCharacters)
  );
  const extraCreditCharacters = characters - monthlyQuotaCharacters;
  let quotaReservationId: string | null = null;
  let creditId: string | null = null;

  try {
    if (monthlyQuotaCharacters > 0) {
      const quota = await deps.reserveMonthlyQuota({
        actor,
        productId: plan.productId,
        operationKey: TEXT_TO_SPEECH_QUOTA_OPERATION_KEYS.speechGenerate,
        units: monthlyQuotaCharacters,
        limit: plan.monthlyCharacters,
        windowStart,
        idempotencyKey: `tts:generate:${generationId}:monthly`,
        expiresAt: addTextToSpeechQuotaReservationMinutes(now, 10),
        entitlementGrantIdsJson: formatEntitlementGrantIdsJson(actor),
        reason: requestHash,
        now,
      });
      quotaReservationId = quota.reservation.id;
    }

    if (extraCreditCharacters > 0) {
      const consumed = await deps.consumeCredits({
        userId: actor.userId,
        credits: extraCreditCharacters,
        scene: 'text-to-speech-generator',
        description: 'Text to Speech Generator usage',
        metadata: JSON.stringify({
          generationId,
          requestHash,
          characters: extraCreditCharacters,
        }),
      });
      creditId = consumed.id;
    }
  } catch (error) {
    if (quotaReservationId) {
      await deps
        .refundMonthlyQuota({
          reservationId: quotaReservationId,
          reason: error instanceof Error ? error.message : 'tts charge failed',
          now,
        })
        .catch(() => undefined);
    }
    if (
      error instanceof Error &&
      error.message.startsWith('Insufficient credits')
    ) {
      throw new ForbiddenError('insufficient text to speech credits');
    }
    throw error;
  }

  return {
    quotaReservationId,
    creditId,
    chargedCharacters: characters,
    monthlyQuotaCharacters,
    extraCreditCharacters,
  };
}

async function commitGenerationCharge({
  charge,
  deps,
  now,
}: {
  charge: TextToSpeechGenerationCharge;
  deps: GenerateStoredTextToSpeechDeps;
  now: Date;
}) {
  if (charge.quotaReservationId) {
    await deps.commitMonthlyQuota({
      reservationId: charge.quotaReservationId,
      now,
    });
  }
}

async function refundGenerationCharge({
  charge,
  deps,
  now,
  reason,
}: {
  charge: TextToSpeechGenerationCharge | undefined;
  deps: GenerateStoredTextToSpeechDeps;
  now: Date;
  reason: string;
}) {
  if (!charge) return;

  if (charge.quotaReservationId) {
    await deps
      .refundMonthlyQuota({
        reservationId: charge.quotaReservationId,
        reason,
        now,
      })
      .catch(() => undefined);
  }

  if (charge.creditId) {
    await deps.refundConsumedCredit(charge.creditId).catch(() => undefined);
  }
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
      chargedCharacters: generation.chargedCharacters,
      monthlyQuotaCharacters: generation.monthlyQuotaCharacters,
      extraCreditCharacters: generation.extraCreditCharacters,
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
  const plan = resolveTextToSpeechPlanLimits(actor);
  const request = resolveTextToSpeechPreviewRequest({
    ...input,
    actorKind: actor.kind === 'user' ? 'user' : 'guest',
    maxCharacters: plan.singleRequestCharacters,
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

  const id = (deps.createId ?? getUuid)();
  let charge: TextToSpeechGenerationCharge | undefined;
  let createdGenerationId = '';
  let chargeCommitted = false;
  let uploadedStorageKey = '';

  try {
    charge = await reserveGenerationCharge({
      actor,
      generationId: id,
      characters: request.characters,
      requestHash: request.requestHash,
      now,
      deps,
    });

    const preview = await generateTextToSpeechPreview({
      input: {
        ...input,
        actorKind: actor.kind === 'user' ? 'user' : 'guest',
        maxCharacters: plan.singleRequestCharacters,
      },
      provider: deps.provider,
    });
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
    uploadedStorageKey = upload.key;

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
      quotaReservationId: charge.quotaReservationId,
      creditId: charge.creditId,
      chargedCharacters: charge.chargedCharacters,
      monthlyQuotaCharacters: charge.monthlyQuotaCharacters,
      extraCreditCharacters: charge.extraCreditCharacters,
      expiresAt: addTextToSpeechRetentionDays(now, plan.retentionDays),
    });
    createdGenerationId = created.id;

    await commitGenerationCharge({ charge, deps, now });
    chargeCommitted = true;

    await deps
      .deleteOverflowGenerations({
        ...owner,
        keep: getTextToSpeechHistoryLimit(actor),
      })
      .catch(() => undefined);

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
  } catch (error) {
    if (!chargeCommitted) {
      if (createdGenerationId) {
        await deps
          .markGenerationDeleted({
            id: createdGenerationId,
            now,
          })
          .catch(() => undefined);
      }
      await refundGenerationCharge({
        charge,
        deps,
        now,
        reason:
          error instanceof Error ? error.message : 'tts generation failed',
      });
      if (uploadedStorageKey) {
        await storage.deleteFiles([uploadedStorageKey]).catch(() => undefined);
      }
    }
    throw error;
  }
}
