
import { createUseCaseLogger } from '@/infra/platform/logging/logger.server';
import {
  generateRequestId,
  getOrCreateRequestId,
} from '@/infra/platform/logging/request-id.server';

import { BusinessError, ExternalError, PublicError } from '@/shared/lib/errors';

import { actionErr, type ActionResult } from './result';

const log = createUseCaseLogger({
  domain: 'platform',
  useCase: 'server-action',
});

async function getActionRequestId(): Promise<string> {
  return generateRequestId();
}

export async function withAction<T>(
  handler: () => Promise<ActionResult & { data?: T }>
): Promise<ActionResult> {
  const requestId = await getActionRequestId();
  try {
    const result = await handler();
    if (result.requestId) return result;
    return { ...result, requestId };
  } catch (error: unknown) {
    if (error instanceof BusinessError) {
      return actionErr(error.publicMessage, requestId);
    }

    if (error instanceof ExternalError) {
      log.error('[action] external error', {
        operation: 'handle-action-error',
        error,
        requestId,
      });
      return actionErr(error.publicMessage, requestId);
    }

    if (error instanceof PublicError) {
      log.error('[action] public error', {
        operation: 'handle-action-error',
        error,
        requestId,
      });
      return actionErr(error.publicMessage, requestId);
    }

    log.error('[action] unhandled error', {
      operation: 'handle-action-error',
      error,
      requestId,
    });
    return actionErr('action failed', requestId);
  }
}
