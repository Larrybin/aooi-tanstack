import type { ProductRuntimeContract } from '@/domains/product-runtime/domain/contract';

export const AI_REMOVER_RUNTIME_CONTRACT = {
  siteKey: 'ai-remover',
  productKey: 'ai-remover',
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
    removerCleanup: true,
  },
} satisfies ProductRuntimeContract;
