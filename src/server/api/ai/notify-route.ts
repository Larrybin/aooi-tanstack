import {
  ForbiddenError,
  ServiceUnavailableError,
} from '@/shared/lib/api/errors';
import { jsonOk } from '@/shared/lib/api/response';
import { readRequestBodyByteCountUpTo } from '@/shared/lib/runtime/request-body';

type AiNotifyLog = {
  info(message: string, meta?: unknown): void;
  warn(message: string, meta?: unknown): void;
};

export type AiNotifyRouteDeps = {
  getLog: (req: Request) => AiNotifyLog;
  getAiNotifyWebhookSecret: () => string;
  verifyAiNotifyCallbackSignature: (input: {
    provider: string;
    taskId: string;
    signature: string;
    secret: string;
  }) => Promise<boolean>;
  readRequestBodyByteCountUpTo: typeof readRequestBodyByteCountUpTo;
};

const MAX_AI_NOTIFY_BODY_BYTES = 64 * 1024;

export function createAiNotifyPostAction(deps: AiNotifyRouteDeps) {
  return async (req: Request, input: { provider: string }) => {
    const { provider } = input;
    const log = deps.getLog(req);
    const url = new URL(req.url);
    const taskId = url.searchParams.get('task_id')?.trim() || '';
    const signature = url.searchParams.get('sig')?.trim() || '';
    const secret = deps.getAiNotifyWebhookSecret();

    if (!secret) {
      throw new ServiceUnavailableError('ai notify webhook is not configured');
    }
    if (
      !taskId ||
      !(await deps.verifyAiNotifyCallbackSignature({
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
      const result = await deps.readRequestBodyByteCountUpTo(
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

    return jsonOk({ ok: true });
  };
}
