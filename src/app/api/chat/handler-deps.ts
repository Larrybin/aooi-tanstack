import { createApiContext } from '@/app/api/_lib/context';
import { requireAiEnabled } from '@/app/api/ai/_lib/guard';
import { getAiProviderBindings } from '@/domains/ai/application/provider-bindings';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { convertToModelMessages, generateId, streamText } from 'ai';

import { readAiRuntimeSettingsCached } from '@/domains/settings/application/settings-runtime.query';
import { createChatDataDeps } from '@/server/api/chat/deps';
import type { ChatHandlerDeps } from '@/server/api/chat/create-handlers';

const dataDeps = createChatDataDeps({
  readAiRuntimeSettings: readAiRuntimeSettingsCached,
  readAiProviderBindings: async () => getAiProviderBindings(),
});

export const chatHandlerRuntimeDeps: ChatHandlerDeps = {
  requireAiEnabled,
  createApiContext,
  generateId,
  now: () => new Date(),
  createProvider: createOpenRouter,
  streamText,
  convertToModelMessages,
  ...dataDeps,
};
