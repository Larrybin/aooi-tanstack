import { resolveConfiguredAICapability } from '@/domains/ai/application/capabilities-core';
import { createAIService } from '@/domains/ai/application/service-builder';
import { isAiEnabled } from '@/domains/ai/domain/enablement';
import {
  createAITask,
  failAITaskByIdAndRefundCredit,
  updateAITaskById,
} from '@/domains/ai/infra/ai-task';
import { createAiGeneratePostHandler } from '@/server/api/ai/generate-route';
import {
  getAiNotifyWebhookSecret,
  signAiNotifyCallback,
} from '@/server/api/ai/notify-signature';
import { createFileRoute } from '@tanstack/react-router';

import { NotFoundError } from '@/shared/lib/api/errors';
import { getUuid } from '@/shared/lib/hash';

import {
  readTanStackAiProviderBindings,
  readTanStackAiRuntimeSettings,
} from '../../../server/ai-runtime';
import { createTanStackApiContext } from '../../../server/api-context';
import { withTanStackCloudflareBindings } from '../../../server/cloudflare-bindings';
import { readTanStackPublicUiConfigCached } from '../../../server/public-ui-config-runtime';

const postAiGenerate = withTanStackCloudflareBindings(
  createAiGeneratePostHandler({
    requireAiEnabled: async () => {
      if (isAiEnabled(await readTanStackPublicUiConfigCached())) {
        return;
      }
      throw new NotFoundError('not found');
    },
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

export const Route = createFileRoute('/api/ai/generate')({
  server: {
    handlers: {
      POST: ({ request }) => postAiGenerate(request),
    },
  },
});
