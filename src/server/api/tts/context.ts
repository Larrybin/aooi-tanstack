import { getRequestLogger } from '@/infra/platform/logging/request-logger.server';
import type { z } from 'zod';

import { parseJson } from '@/shared/lib/api/parse';

export type TextToSpeechApiContext = {
  log: ReturnType<typeof getRequestLogger>['log'];
  parseJson: <TSchema extends z.ZodTypeAny>(
    schema: TSchema
  ) => Promise<z.infer<TSchema>>;
};

export function createTextToSpeechApiContext(
  req: Request
): TextToSpeechApiContext {
  const { log } = getRequestLogger(req);

  return {
    log,
    parseJson: (schema) => parseJson(req, schema),
  };
}
