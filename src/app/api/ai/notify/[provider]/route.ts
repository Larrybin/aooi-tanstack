import { createApiContext } from '@/app/api/_lib/context';
import { createAiNotifyPostAction } from '@/server/api/ai/notify-route';
import {
  getAiNotifyWebhookSecret,
  verifyAiNotifyCallbackSignature,
} from '@/server/api/ai/notify-signature';

import { withApi } from '@/shared/lib/api/route';
import { readRequestBodyByteCountUpTo } from '@/shared/lib/runtime/request-body';
import { AiNotifyParamsSchema } from '@/shared/schemas/api/ai/notify';

const postAction = createAiNotifyPostAction({
  getLog: (request) => createApiContext(request).log,
  getAiNotifyWebhookSecret,
  verifyAiNotifyCallbackSignature,
  readRequestBodyByteCountUpTo,
});

export const POST = withApi(
  async (
    request: Request,
    { params }: { params: Promise<{ provider: string }> }
  ) => {
    const api = createApiContext(request);
    const { provider } = await api.parseParams(params, AiNotifyParamsSchema);
    return postAction(request, { provider });
  }
);
