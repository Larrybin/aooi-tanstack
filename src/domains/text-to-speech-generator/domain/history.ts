import { ForbiddenError, NotFoundError } from '@/shared/lib/api/errors';

import { resolveTextToSpeechPlanLimits } from './plan';
import type { TextToSpeechActor } from './types';

export type TextToSpeechGenerationRecord = {
  id: string;
  userId: string | null;
  anonymousSessionId: string | null;
  status: string;
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
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  expiresAt: Date;
};

export function buildTextToSpeechTextPreview(text: string): string {
  return Array.from(text).slice(0, 100).join('');
}

export function assertTextToSpeechGenerationOwner({
  actor,
  generation,
}: {
  actor: TextToSpeechActor;
  generation: TextToSpeechGenerationRecord | undefined;
}): TextToSpeechGenerationRecord {
  if (!generation || generation.deletedAt) {
    throw new NotFoundError('text to speech generation not found');
  }

  if (actor.kind === 'user') {
    if (
      generation.userId === actor.userId ||
      (!generation.userId &&
        actor.anonymousSessionId &&
        generation.anonymousSessionId === actor.anonymousSessionId)
    ) {
      return generation;
    }
    throw new ForbiddenError('text to speech generation is not accessible');
  }

  if (
    !generation.userId &&
    generation.anonymousSessionId === actor.anonymousSessionId
  ) {
    return generation;
  }

  throw new ForbiddenError('text to speech generation is not accessible');
}

export function assertTextToSpeechGenerationDownloadable({
  actor,
  generation,
  now = new Date(),
}: {
  actor: TextToSpeechActor;
  generation: TextToSpeechGenerationRecord | undefined;
  now?: Date;
}): TextToSpeechGenerationRecord {
  const owned = assertTextToSpeechGenerationOwner({ actor, generation });
  if (actor.kind !== 'user') {
    throw new ForbiddenError('sign in to download MP3 files');
  }
  if (owned.status !== 'generated' || owned.expiresAt <= now) {
    throw new NotFoundError('text to speech audio not found');
  }
  return owned;
}

export function serializeTextToSpeechGenerationForClient({
  actor,
  generation,
  now = new Date(),
}: {
  actor: TextToSpeechActor;
  generation: TextToSpeechGenerationRecord;
  now?: Date;
}) {
  const expired = generation.expiresAt <= now;

  return {
    id: generation.id,
    status: expired ? 'expired' : generation.status,
    textPreview: generation.textPreview,
    characterCount: generation.characterCount,
    language: generation.language,
    voice: generation.voice,
    model: generation.model,
    outputFormat: generation.outputFormat,
    createdAt: generation.createdAt,
    expiresAt: generation.expiresAt,
    chargedCharacters: generation.chargedCharacters,
    monthlyQuotaCharacters: generation.monthlyQuotaCharacters,
    extraCreditCharacters: generation.extraCreditCharacters,
    audioAvailable: generation.status === 'generated' && !expired,
    downloadAvailable:
      actor.kind === 'user' && generation.status === 'generated' && !expired,
  };
}

export function getTextToSpeechHistoryLimit(actor: TextToSpeechActor): number {
  return resolveTextToSpeechPlanLimits(actor).historyItems;
}
