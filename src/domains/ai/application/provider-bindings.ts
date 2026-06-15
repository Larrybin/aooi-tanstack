
import type { AiProviderBindings } from '@/domains/settings/application/settings-runtime.contracts';
import { getRuntimeEnvString } from '@/infra/runtime/env.server';

function readAiProviderBindings(): AiProviderBindings {
  return {
    openrouterApiKey: getRuntimeEnvString('OPENROUTER_API_KEY')?.trim() || '',
    replicateApiToken: getRuntimeEnvString('REPLICATE_API_TOKEN')?.trim() || '',
    falApiKey: getRuntimeEnvString('FAL_API_KEY')?.trim() || '',
    kieApiKey: getRuntimeEnvString('KIE_API_KEY')?.trim() || '',
  };
}

export function getAiProviderBindings(): AiProviderBindings {
  return { ...readAiProviderBindings() };
}
