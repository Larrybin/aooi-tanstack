
import {
  createUseCaseLogger,
  logger,
} from '@/infra/platform/logging/logger.server';
import {
  getRequestContext,
  type RequestContext,
} from '@/infra/platform/logging/request-context.server';

export type RequestLogger = {
  ctx: RequestContext;
  log: ReturnType<typeof logger.with>;
};

export function getRequestLogger(req: Request): RequestLogger {
  const ctx = getRequestContext(req);
  return { ctx, log: logger.with(ctx) };
}

export function getRequestUseCaseLogger(
  req: Request,
  context: { domain: string; useCase: string; operation?: string }
): RequestLogger {
  const ctx = getRequestContext(req);
  return {
    ctx,
    log: createUseCaseLogger({ ...context, requestId: ctx.requestId }),
  };
}
