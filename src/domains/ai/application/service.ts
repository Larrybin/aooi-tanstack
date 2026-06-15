import 'server-only';

import { getAiProviderBindings } from './provider-bindings';
import { createAIService, type AIService } from './service-builder';

export { createAIService as getAIService, type AIService };

export async function getConfiguredAIService(): Promise<AIService> {
  const { readAiRuntimeSettingsCached } =
    await import('@/domains/settings/application/settings-runtime.query');
  return createAIService({
    settings: await readAiRuntimeSettingsCached(),
    bindings: getAiProviderBindings(),
  });
}
