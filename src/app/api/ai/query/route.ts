import { getAiProviderBindings } from '@/domains/ai/application/provider-bindings';
import { getAIService } from '@/domains/ai/application/service';
import {
  failAITaskByIdAndRefundCredit,
  findAITaskById,
  updateAITaskById,
} from '@/domains/ai/infra/ai-task';
import { createAiQueryPostHandler } from '@/server/api/ai/query-route';

import { createLimiterFactory } from '@/shared/lib/api/limiters-factory';
import { resolveConfigConsistencyMode } from '@/shared/lib/config-consistency';

import { createApiContext } from '../../_lib/context';
import { requireAiEnabled } from '../_lib/guard';

export const POST = createAiQueryPostHandler({
  resolveConfigConsistencyMode,
  requireAiEnabled,
  getApiContext: createApiContext,
  findAITaskById,
  updateAITaskById,
  failAITaskByIdAndRefundCredit,
  readAiRuntimeSettings: async (mode) => {
    const mod = await import(
      '@/domains/settings/application/' + 'settings-runtime.query'
    );
    return mode === 'fresh'
      ? mod.readAiRuntimeSettingsFresh()
      : mod.readAiRuntimeSettingsCached();
  },
  readAiProviderBindings: getAiProviderBindings,
  getAIService,
  rateLimiter: createLimiterFactory().createAiQueryCooldownLimiter(),
});
