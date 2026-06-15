import { createAIService } from '@/domains/ai/application/service-builder';
import { isAiEnabled } from '@/domains/ai/domain/enablement';
import {
  failAITaskByIdAndRefundCredit,
  findAITaskById,
  updateAITaskById,
} from '@/domains/ai/infra/ai-task';
import { createAiQueryPostHandler } from '@/server/api/ai/query-route';
import { createFileRoute } from '@tanstack/react-router';

import { NotFoundError } from '@/shared/lib/api/errors';
import { createLimiterFactory } from '@/shared/lib/api/limiters-factory';
import { resolveConfigConsistencyMode } from '@/shared/lib/config-consistency';

import {
  readTanStackAiProviderBindings,
  readTanStackAiRuntimeSettings,
} from '../../../server/ai-runtime';
import { createTanStackApiContext } from '../../../server/api-context';
import { withTanStackCloudflareBindings } from '../../../server/cloudflare-bindings';
import { readTanStackPublicUiConfigCached } from '../../../server/public-ui-config-runtime';

const postAiQuery = withTanStackCloudflareBindings(
  createAiQueryPostHandler({
    resolveConfigConsistencyMode,
    requireAiEnabled: async () => {
      if (isAiEnabled(await readTanStackPublicUiConfigCached())) {
        return;
      }
      throw new NotFoundError('not found');
    },
    getApiContext: createTanStackApiContext,
    findAITaskById,
    updateAITaskById,
    failAITaskByIdAndRefundCredit,
    readAiRuntimeSettings: async () => readTanStackAiRuntimeSettings(),
    readAiProviderBindings: readTanStackAiProviderBindings,
    getAIService: createAIService,
    rateLimiter: createLimiterFactory().createAiQueryCooldownLimiter(),
  })
);

export const Route = createFileRoute('/api/ai/query')({
  server: {
    handlers: {
      POST: ({ request }) => postAiQuery(request),
    },
  },
});
