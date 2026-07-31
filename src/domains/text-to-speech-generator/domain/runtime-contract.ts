import type { ProductRuntimeContract } from '@/domains/product-runtime/domain/contract';

export const TEXT_TO_SPEECH_GENERATOR_RUNTIME_CONTRACT = {
  siteKey: 'text-to-speech-generator',
  productKey: 'text-to-speech-generator',
  requiredWorkers: {
    app: true,
  },
  requiredBindings: {
    workersAi: true,
  },
  requiredResources: {
    r2: true,
    state: true,
  },
  requiredVars: {
    storagePublicBaseUrl: true,
  },
  requiredSecrets: {
    turnstile: true,
  },
} satisfies ProductRuntimeContract;
