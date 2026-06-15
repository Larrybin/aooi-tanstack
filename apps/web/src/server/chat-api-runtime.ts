import { isAiEnabled } from '@/domains/ai/domain/enablement';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { convertToModelMessages, generateId, streamText } from 'ai';

import { NotFoundError } from '@/shared/lib/api/errors';
import { createChatDataDeps } from '@/server/api/chat/deps';
import type { ChatHandlerDeps } from '@/server/api/chat/create-handlers';

import {
  readTanStackAiProviderBindings,
  readTanStackAiRuntimeSettings,
} from './ai-runtime';
import { createTanStackApiContext } from './api-context';
import { readTanStackPublicUiConfigCached } from './public-ui-config-runtime';

async function requireTanStackChatAiEnabled() {
  if (isAiEnabled(await readTanStackPublicUiConfigCached())) {
    return;
  }
  throw new NotFoundError('not found');
}

export function createTanStackChatHandlerDeps(): ChatHandlerDeps {
  return {
    requireAiEnabled: requireTanStackChatAiEnabled,
    createApiContext: createTanStackApiContext,
    generateId,
    now: () => new Date(),
    createProvider: createOpenRouter,
    streamText,
    convertToModelMessages,
    ...createChatDataDeps({
      readAiRuntimeSettings: readTanStackAiRuntimeSettings,
      readAiProviderBindings: readTanStackAiProviderBindings,
    }),
  };
}
