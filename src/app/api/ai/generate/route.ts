import { createApiContext } from '@/app/api/_lib/context';
import { requireAiEnabled } from '@/app/api/ai/_lib/guard';
import { resolveConfiguredAICapability } from '@/domains/ai/application/capabilities';
import { getAiProviderBindings } from '@/domains/ai/application/provider-bindings';
import { getAIService } from '@/domains/ai/application/service';
import {
  createAITask,
  failAITaskByIdAndRefundCredit,
  updateAITaskById,
} from '@/domains/ai/infra/ai-task';
import { readAiRuntimeSettingsCached } from '@/domains/settings/application/settings-runtime.query';
import { createAiGeneratePostHandler } from '@/server/api/ai/generate-route';
import {
  getAiNotifyWebhookSecret,
  signAiNotifyCallback,
} from '@/server/api/ai/notify-signature';

import { getUuid } from '@/shared/lib/hash';

export const POST = createAiGeneratePostHandler({
  requireAiEnabled,
  createApiContext,
  readAiRuntimeSettings: readAiRuntimeSettingsCached,
  readAiProviderBindings: getAiProviderBindings,
  getAIService,
  resolveConfiguredAICapability,
  createAITask,
  updateAITaskById,
  failAITaskByIdAndRefundCredit,
  getUuid,
  getAiNotifyWebhookSecret,
  signAiNotifyCallback,
});
