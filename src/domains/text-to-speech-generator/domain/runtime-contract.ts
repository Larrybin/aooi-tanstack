import type { ProductRuntimeContract } from '@/domains/product-runtime/domain/contract';

export const TEXT_TO_SPEECH_GENERATOR_RUNTIME_CONTRACT = {
  siteKey: 'text-to-speech-generator',
  productKey: 'text-to-speech-generator',
  requiredWorkers: {
    'public-web': true,
  },
  requiredBindings: {
    workersAi: true,
  },
  requiredVars: {
    storagePublicBaseUrl: true,
  },
  requiredSecrets: {},
} satisfies ProductRuntimeContract;
