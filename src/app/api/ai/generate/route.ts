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

import { withApi } from '@/shared/lib/api/route';
import { getUuid } from '@/shared/lib/hash';

import {
  getAiNotifyWebhookSecret,
  signAiNotifyCallback,
} from '../notify/signature';
import { createAiGeneratePostAction } from './create-handler';

export const POST = withApi(
  createAiGeneratePostAction({
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
  })
);
