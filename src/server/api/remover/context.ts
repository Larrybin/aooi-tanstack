import { getRequestLogger } from '@/infra/platform/logging/request-logger.server';
import type { z } from 'zod';

import { parseJson, parseParams } from '@/shared/lib/api/parse';

export type RemoverApiContext = {
  log: ReturnType<typeof getRequestLogger>['log'];
  parseJson: <TSchema extends z.ZodTypeAny>(
    schema: TSchema
  ) => Promise<z.infer<TSchema>>;
  parseParams: <TSchema extends z.ZodTypeAny>(
    paramsPromise: Promise<unknown>,
    schema: TSchema
  ) => Promise<z.infer<TSchema>>;
};

export function createRemoverApiContext(req: Request): RemoverApiContext {
  const { log } = getRequestLogger(req);

  return {
    log,
    parseJson: (schema) => parseJson(req, schema),
    parseParams: (paramsPromise, schema) => parseParams(paramsPromise, schema),
  };
}
