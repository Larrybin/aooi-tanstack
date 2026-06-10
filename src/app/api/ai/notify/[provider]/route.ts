import { createApiContext } from '@/app/api/_lib/context';

import {
  ForbiddenError,
  ServiceUnavailableError,
} from '@/shared/lib/api/errors';
import { jsonOk } from '@/shared/lib/api/response';
import { withApi } from '@/shared/lib/api/route';
import { readRequestBodyByteCountUpTo } from '@/shared/lib/runtime/request-body';
import { AiNotifyParamsSchema } from '@/shared/schemas/api/ai/notify';

import {
  getAiNotifyWebhookSecret,
  verifyAiNotifyCallbackSignature,
} from '../signature';

const MAX_AI_NOTIFY_BODY_BYTES = 64 * 1024;

export const POST = withApi(
  async (
    req: Request,
    { params }: { params: Promise<{ provider: string }> }
  ) => {
    const api = createApiContext(req);
    const { log } = api;
    const { provider } = await api.parseParams(params, AiNotifyParamsSchema);
    const url = new URL(req.url);
    const taskId = url.searchParams.get('task_id')?.trim() || '';
    const signature = url.searchParams.get('sig')?.trim() || '';
    const secret = getAiNotifyWebhookSecret();

    if (!secret) {
      throw new ServiceUnavailableError('ai notify webhook is not configured');
    }
    if (
      !taskId ||
      !(await verifyAiNotifyCallbackSignature({
        provider,
        taskId,
        signature,
        secret,
      }))
    ) {
      throw new ForbiddenError('invalid ai notify signature');
    }

    const contentType = req.headers.get('content-type') || null;
    const contentLengthHeader = req.headers.get('content-length') || null;

    let bodyBytesRead: number | null = null;
    let truncated = false;
    try {
      const result = await readRequestBodyByteCountUpTo(
        req,
        MAX_AI_NOTIFY_BODY_BYTES
      );
      bodyBytesRead = result.bytesRead;
      truncated = result.truncated;
    } catch (error: unknown) {
      log.warn('ai: notify body read failed', { provider, error });
    }

    log.info('ai: notify received', {
      provider,
      taskId,
      contentType,
      contentLengthHeader,
      bodyBytesRead,
      truncated,
      maxBodyBytes: MAX_AI_NOTIFY_BODY_BYTES,
    });

    // Always ack 2xx to avoid upstream marking callback as failed.
    return jsonOk({ ok: true });
  }
);
