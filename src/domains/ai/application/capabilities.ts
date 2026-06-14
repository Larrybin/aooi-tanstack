import type { AICapabilitySelection } from '@/shared/types/ai-capability';

import {
  listConfiguredAICapabilities,
  requireCapability,
  resolveConfiguredAICapability,
} from './capabilities-core';

export {
  listConfiguredAICapabilities,
  requireCapability,
  resolveConfiguredAICapability,
};

export async function listPublicAICapabilities() {
  const [{ readAiRuntimeSettingsCached }, { getAiProviderBindings }] =
    await Promise.all([
      import('@/domains/settings/application/settings-runtime.query'),
      import('./provider-bindings'),
    ]);
  const settings = await readAiRuntimeSettingsCached();
  const bindings = getAiProviderBindings();

  return listConfiguredAICapabilities(settings, bindings);
}

export async function resolvePublicAICapability(
  selection: AICapabilitySelection
) {
  const [{ readAiRuntimeSettingsCached }, { getAiProviderBindings }] =
    await Promise.all([
      import('@/domains/settings/application/settings-runtime.query'),
      import('./provider-bindings'),
    ]);
  const settings = await readAiRuntimeSettingsCached();
  const bindings = getAiProviderBindings();

  return resolveConfiguredAICapability(settings, bindings, selection);
}
