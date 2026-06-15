import type {
  AiProviderBindings,
  AiRuntimeSettings,
} from '@/domains/settings/application/settings-runtime.contracts';

import { AIMediaType, type AIProvider } from '@/extensions/ai';
import { KieProvider, ReplicateProvider } from '@/extensions/ai/providers';
import { ServiceUnavailableError } from '@/shared/lib/api/errors';
import {
  ProviderRegistry,
  trimmedProviderNameKey,
} from '@/shared/lib/providers/provider-registry';


export type AIService = {
  getProvider(name: string): AIProvider | undefined;
  getDefaultProvider(): AIProvider | undefined;
  getMediaTypes(): string[];
};

/**
 * get ai manager with configs
 */
export function createAIService({
  settings: _settings,
  bindings,
}: {
  settings: AiRuntimeSettings;
  bindings: AiProviderBindings;
}) {
  const registry = new ProviderRegistry<AIProvider>({
    toNameKey: trimmedProviderNameKey,
  });

  if (bindings.kieApiKey) {
    registry.addUnique(
      new KieProvider({
        apiKey: bindings.kieApiKey,
      }),
      {
        invalidNameError: () =>
          new ServiceUnavailableError('AI provider name is required'),
        duplicateNameError: (name) =>
          new ServiceUnavailableError(
            `AI provider '${name}' is already registered`
          ),
      }
    );
  }

  if (bindings.replicateApiToken) {
    registry.addUnique(
      new ReplicateProvider({
        apiToken: bindings.replicateApiToken,
      }),
      {
        invalidNameError: () =>
          new ServiceUnavailableError('AI provider name is required'),
        duplicateNameError: (name) =>
          new ServiceUnavailableError(
            `AI provider '${name}' is already registered`
          ),
      }
    );
  }

  return {
    getProvider: (name) => registry.get(name),
    getDefaultProvider: () => registry.getDefault(),
    getMediaTypes: () => Object.values(AIMediaType),
  } satisfies AIService;
}
