import { getSignedInUserIdentityFromRequest } from '@/infra/platform/auth/session-by-request';
import { getRequestLogger } from '@/infra/platform/logging/request-logger.server';
import type { z } from 'zod';

import { assertCsrf } from '@/shared/lib/api/csrf.server';
import {
  BadRequestError,
  PayloadTooLargeError,
  UnauthorizedError,
} from '@/shared/lib/api/errors';
import { tryJsonParse } from '@/shared/lib/json';
import { readRequestTextWithLimit } from '@/shared/lib/runtime/request-body';
import type { AuthSessionUserIdentity } from '@/shared/types/auth-session';

import { requireTanStackPermission } from './permission-context';

const JSON_BODY_LIMIT_BYTES = 1024 * 1024;

export type TanStackApiLog = {
  debug(message: string, meta?: unknown): void;
  info(message: string, meta?: unknown): void;
  warn(message: string, meta?: unknown): void;
  error(message: string, meta?: unknown): void;
};

export type TanStackApiContext = {
  log: TanStackApiLog;
  parseJson: <TSchema extends z.ZodTypeAny>(
    schema: TSchema
  ) => Promise<z.infer<TSchema>>;
  requireUser: () => Promise<AuthSessionUserIdentity>;
  requirePermission: (userId: string, code: string) => Promise<void>;
};

function parseContentLengthHeader(value: string | null): number | null {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = Number.parseInt(trimmed, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

async function parseJson<TSchema extends z.ZodTypeAny>(
  request: Request,
  schema: TSchema
): Promise<z.infer<TSchema>> {
  try {
    const contentLength = parseContentLengthHeader(
      request.headers.get('content-length')
    );
    if (contentLength !== null && contentLength > JSON_BODY_LIMIT_BYTES) {
      throw new PayloadTooLargeError('payload too large');
    }

    const rawText = await readRequestTextWithLimit(
      request,
      JSON_BODY_LIMIT_BYTES
    );
    const parsed = tryJsonParse<unknown>(rawText);
    if (!parsed.ok) {
      throw new BadRequestError('invalid json body');
    }

    const result = schema.safeParse(parsed.value);
    if (!result.success) {
      throw new BadRequestError('invalid request params', {
        issues: result.error.issues,
      });
    }

    return result.data;
  } catch (error) {
    if (
      error instanceof BadRequestError ||
      error instanceof PayloadTooLargeError
    ) {
      throw error;
    }
    throw new BadRequestError('invalid json body');
  }
}

async function requireUser(request: Request): Promise<AuthSessionUserIdentity> {
  assertCsrf(request);

  const user = await getSignedInUserIdentityFromRequest(request);
  if (!user) {
    throw new UnauthorizedError('no auth, please sign in');
  }

  return user;
}

export function createTanStackApiContext(request: Request): TanStackApiContext {
  const { log } = getRequestLogger(request);

  return {
    log,
    parseJson: (schema) => parseJson(request, schema),
    requireUser: () => requireUser(request),
    requirePermission: requireTanStackPermission,
  };
}
