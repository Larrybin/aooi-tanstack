import { resolveConfiguredAICapability } from '@/domains/ai/application/capabilities-core';
import { createAIService } from '@/domains/ai/application/service-builder';
import { isAiEnabled } from '@/domains/ai/domain/enablement';
import {
  createAITask,
  failAITaskByIdAndRefundCredit,
  findAITaskById,
  updateAITaskById,
} from '@/domains/ai/infra/ai-task';
import { createAiGeneratePostHandler } from '@/server/api/ai/generate-route';
import {
  getAiNotifyWebhookSecret,
  signAiNotifyCallback,
} from '@/server/api/ai/notify-signature';
import { createAiQueryPostHandler } from '@/server/api/ai/query-route';

import { NotFoundError } from '@/shared/lib/api/errors';
import { createLimiterFactory } from '@/shared/lib/api/limiters-factory';
import { resolveConfigConsistencyMode } from '@/shared/lib/config-consistency';
import { getUuid } from '@/shared/lib/hash';

import {
  readTanStackAiProviderBindings,
  readTanStackAiRuntimeSettings,
} from '../ai-runtime';
import { createTanStackApiContext } from '../api-context';
import { withTanStackCloudflareBindings } from '../cloudflare-bindings';
import { readTanStackPublicUiConfigCached } from '../public-ui-config-runtime';

async function requireAiEnabled() {
  if (isAiEnabled(await readTanStackPublicUiConfigCached())) {
    return;
  }
  throw new NotFoundError('not found');
}

export const postAiQuery = withTanStackCloudflareBindings(
  createAiQueryPostHandler({
    resolveConfigConsistencyMode,
    requireAiEnabled,
    getApiContext: createTanStackApiContext,
    findAITaskById,
    updateAITaskById,
    failAITaskByIdAndRefundCredit,
    readAiRuntimeSettings: readTanStackAiRuntimeSettings,
    readAiProviderBindings: readTanStackAiProviderBindings,
    getAIService: createAIService,
    rateLimiter: createLimiterFactory().createAiQueryCooldownLimiter(),
  })
);

export const postAiGenerate = withTanStackCloudflareBindings(
  createAiGeneratePostHandler({
    requireAiEnabled,
    createApiContext: createTanStackApiContext,
    readAiRuntimeSettings: readTanStackAiRuntimeSettings,
    readAiProviderBindings: readTanStackAiProviderBindings,
    getAIService: createAIService,
    resolveConfiguredAICapability,
    createAITask,
    updateAITaskById,
    failAITaskByIdAndRefundCredit,
    getUuid,
    getAiNotifyWebhookSecret,
    signAiNotifyCallback,
  })
);
