import { createHash } from 'node:crypto';

import {
  TEXT_TO_SPEECH_GENERATOR_GUEST_REQUEST_CHARACTERS,
  TEXT_TO_SPEECH_GENERATOR_OUTPUT_FORMAT,
  TEXT_TO_SPEECH_GENERATOR_SIGNED_IN_REQUEST_CHARACTERS,
  TEXT_TO_SPEECH_LANGUAGES,
  TEXT_TO_SPEECH_VOICES,
  type TextToSpeechLanguage,
  type TextToSpeechVoiceConfig,
} from './config';

export type TextToSpeechActorKind = 'guest' | 'user';

export type TextToSpeechPreviewRequest = {
  text: string;
  language: string;
  voice: string;
  actorKind: TextToSpeechActorKind;
  maxCharacters?: number;
};

export type ResolvedTextToSpeechPreviewRequest = {
  text: string;
  characters: number;
  language: TextToSpeechLanguage;
  voice: TextToSpeechVoiceConfig;
  modelId: string;
  outputFormat: typeof TEXT_TO_SPEECH_GENERATOR_OUTPUT_FORMAT;
  requestHash: string;
};

const BLOCKED_CONTENT_PATTERNS = [
  /\bimpersonat(?:e|ion|ing)\b/iu,
  /\bphishing\b/iu,
  /\bscam\b/iu,
  /\bdeepfake\b/iu,
  /\bsexual exploitation\b/iu,
  /\bharassment\b/iu,
];

export class TextToSpeechRequestError extends Error {
  readonly code:
    | 'empty_text'
    | 'text_too_long'
    | 'unsupported_language'
    | 'unsupported_voice'
    | 'blocked_content';

  constructor(
    code: TextToSpeechRequestError['code'],
    message: string,
    readonly data?: unknown
  ) {
    super(message);
    this.name = 'TextToSpeechRequestError';
    this.code = code;
  }
}

export function normalizeTextToSpeechText(text: string): string {
  return text.replace(/\s+/gu, ' ').trim();
}

export function countTextToSpeechCharacters(text: string): number {
  return Array.from(text).length;
}

function findLanguage(language: string) {
  return TEXT_TO_SPEECH_LANGUAGES.find((item) => item.code === language);
}

function findVoice(voiceId: string) {
  return TEXT_TO_SPEECH_VOICES.find((item) => item.id === voiceId);
}

function isVoiceAvailableForLanguage({
  voice,
  language,
}: {
  voice: TextToSpeechVoiceConfig;
  language: TextToSpeechLanguage;
}): boolean {
  if (voice.language === language) {
    return true;
  }

  return (
    voice.language === 'multi' &&
    voice.modelId === findLanguage(language)?.modelId
  );
}

export function buildTextToSpeechRequestHash(input: {
  text: string;
  language: TextToSpeechLanguage;
  voiceId: string;
  modelId: string;
}): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        text: input.text,
        language: input.language,
        voice: input.voiceId,
        model: input.modelId,
        outputFormat: TEXT_TO_SPEECH_GENERATOR_OUTPUT_FORMAT,
      })
    )
    .digest('hex');
}

export function resolveTextToSpeechPreviewRequest(
  request: TextToSpeechPreviewRequest
): ResolvedTextToSpeechPreviewRequest {
  const text = normalizeTextToSpeechText(request.text);
  if (!text) {
    throw new TextToSpeechRequestError('empty_text', 'text is required');
  }

  const maxCharacters =
    request.maxCharacters ??
    (request.actorKind === 'guest'
      ? TEXT_TO_SPEECH_GENERATOR_GUEST_REQUEST_CHARACTERS
      : TEXT_TO_SPEECH_GENERATOR_SIGNED_IN_REQUEST_CHARACTERS);
  const characters = countTextToSpeechCharacters(text);
  if (characters > maxCharacters) {
    throw new TextToSpeechRequestError('text_too_long', 'text is too long', {
      maxCharacters,
      characters,
    });
  }

  const blockedPattern = BLOCKED_CONTENT_PATTERNS.find((pattern) =>
    pattern.test(text)
  );
  if (blockedPattern) {
    throw new TextToSpeechRequestError(
      'blocked_content',
      'text violates the usage policy'
    );
  }

  const language = findLanguage(request.language);
  if (!language) {
    throw new TextToSpeechRequestError(
      'unsupported_language',
      'unsupported language'
    );
  }

  const voice = findVoice(request.voice);
  if (
    !voice ||
    !isVoiceAvailableForLanguage({ voice, language: language.code })
  ) {
    throw new TextToSpeechRequestError(
      'unsupported_voice',
      'unsupported voice'
    );
  }

  return {
    text,
    characters,
    language: language.code,
    voice,
    modelId: language.modelId,
    outputFormat: TEXT_TO_SPEECH_GENERATOR_OUTPUT_FORMAT,
    requestHash: buildTextToSpeechRequestHash({
      text,
      language: language.code,
      voiceId: voice.id,
      modelId: language.modelId,
    }),
  };
}
