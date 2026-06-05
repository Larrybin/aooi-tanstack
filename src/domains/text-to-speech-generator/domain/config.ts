export const TEXT_TO_SPEECH_GENERATOR_SITE_KEY =
  'text-to-speech-generator' as const;

export const TEXT_TO_SPEECH_GENERATOR_OUTPUT_FORMAT = 'mp3' as const;
export const TEXT_TO_SPEECH_GENERATOR_GUEST_REQUEST_CHARACTERS = 1000;
export const TEXT_TO_SPEECH_GENERATOR_SIGNED_IN_REQUEST_CHARACTERS = 20000;

export type TextToSpeechLanguage = 'en' | 'es' | 'fr' | 'de' | 'ja' | 'pt';

export type TextToSpeechLanguageConfig = {
  code: TextToSpeechLanguage;
  label: string;
  status: 'official' | 'beta';
  provider: 'cloudflare-workers-ai';
  modelId: string;
};

export type TextToSpeechVoiceConfig = {
  id: string;
  label: string;
  language: TextToSpeechLanguage | 'multi';
  provider: 'cloudflare-workers-ai';
  modelId: string;
  speaker?: string;
  modelTier: 'standard';
  isBeta: boolean;
  availablePlans: readonly [
    'free',
    'lifetime-basic',
    'lifetime-pro',
    'extra-credits-250k',
  ];
};

const ALL_PLANS = [
  'free',
  'lifetime-basic',
  'lifetime-pro',
  'extra-credits-250k',
] as const;

export const TEXT_TO_SPEECH_LANGUAGES = [
  {
    code: 'en',
    label: 'English',
    status: 'official',
    provider: 'cloudflare-workers-ai',
    modelId: '@cf/deepgram/aura-2-en',
  },
  {
    code: 'es',
    label: 'Spanish',
    status: 'official',
    provider: 'cloudflare-workers-ai',
    modelId: '@cf/deepgram/aura-2-es',
  },
  {
    code: 'fr',
    label: 'French',
    status: 'beta',
    provider: 'cloudflare-workers-ai',
    modelId: '@cf/myshell-ai/melotts',
  },
  {
    code: 'de',
    label: 'German',
    status: 'beta',
    provider: 'cloudflare-workers-ai',
    modelId: '@cf/myshell-ai/melotts',
  },
  {
    code: 'ja',
    label: 'Japanese',
    status: 'beta',
    provider: 'cloudflare-workers-ai',
    modelId: '@cf/myshell-ai/melotts',
  },
  {
    code: 'pt',
    label: 'Portuguese',
    status: 'beta',
    provider: 'cloudflare-workers-ai',
    modelId: '@cf/myshell-ai/melotts',
  },
] as const satisfies readonly TextToSpeechLanguageConfig[];

export const TEXT_TO_SPEECH_VOICES = [
  {
    id: 'aura-asteria-en',
    label: 'Asteria',
    language: 'en',
    provider: 'cloudflare-workers-ai',
    modelId: '@cf/deepgram/aura-2-en',
    speaker: 'asteria',
    modelTier: 'standard',
    isBeta: false,
    availablePlans: ALL_PLANS,
  },
  {
    id: 'aura-luna-en',
    label: 'Luna',
    language: 'en',
    provider: 'cloudflare-workers-ai',
    modelId: '@cf/deepgram/aura-2-en',
    speaker: 'luna',
    modelTier: 'standard',
    isBeta: false,
    availablePlans: ALL_PLANS,
  },
  {
    id: 'aura-celeste-es',
    label: 'Celeste',
    language: 'es',
    provider: 'cloudflare-workers-ai',
    modelId: '@cf/deepgram/aura-2-es',
    speaker: 'celeste',
    modelTier: 'standard',
    isBeta: false,
    availablePlans: ALL_PLANS,
  },
  {
    id: 'melotts-standard',
    label: 'Standard Beta',
    language: 'multi',
    provider: 'cloudflare-workers-ai',
    modelId: '@cf/myshell-ai/melotts',
    modelTier: 'standard',
    isBeta: true,
    availablePlans: ALL_PLANS,
  },
] as const satisfies readonly TextToSpeechVoiceConfig[];

export const TEXT_TO_SPEECH_PLAYBACK_SPEEDS = [
  '0.75x',
  '1x',
  '1.25x',
  '1.5x',
] as const;
