import {
  listAvailableAICapabilities,
  resolveAICapability,
  type AIProviderAvailability,
} from '@/domains/ai/domain/capabilities';
import type {
  AiProviderBindings,
  AiRuntimeSettings,
} from '@/domains/settings/application/settings-runtime.contracts';

import {
  BadRequestError,
  ServiceUnavailableError,
} from '@/shared/lib/api/errors';
import type {
  AICapability,
  AICapabilitySelection,
} from '@/shared/types/ai-capability';

function toAIProviderAvailability(
  bindings: AiProviderBindings
): AIProviderAvailability {
  return {
    kie: Boolean(bindings.kieApiKey),
    replicate: Boolean(bindings.replicateApiToken),
  };
}

export function listConfiguredAICapabilities(
  settings: AiRuntimeSettings,
  bindings: AiProviderBindings
) {
  if (!settings.aiEnabled) {
    return [];
  }

  return listAvailableAICapabilities(toAIProviderAvailability(bindings));
}

export function resolveConfiguredAICapability(
  settings: AiRuntimeSettings,
  bindings: AiProviderBindings,
  selection: AICapabilitySelection
) {
  if (!settings.aiEnabled) {
    throw new ServiceUnavailableError('ai capability not available');
  }

  const capability = resolveAICapability(
    toAIProviderAvailability(bindings),
    selection
  );

  if (!capability) {
    throw new BadRequestError('invalid ai capability');
  }

  return capability;
}

export function requireCapability(
  capability: AICapability | undefined
): AICapability {
  if (!capability) {
    throw new ServiceUnavailableError('ai capability not available');
  }

  return capability;
}
