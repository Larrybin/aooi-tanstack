import { getSignedInUserIdentityFromRequest } from '@/infra/platform/auth/session-by-request';
import { site } from '@/site';
import type { z } from 'zod';

import {
  BadRequestError,
  ForbiddenError,
  PayloadTooLargeError,
  UnauthorizedError,
} from '@/shared/lib/api/errors';
import { tryJsonParse } from '@/shared/lib/json';
import { readRequestTextWithLimit } from '@/shared/lib/runtime/request-body';
import type { AuthSessionUserIdentity } from '@/shared/types/auth-session';

const JSON_BODY_LIMIT_BYTES = 1024 * 1024;
const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

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
};

const consoleLog: TanStackApiLog = {
  debug: (message, meta) =>
    meta === undefined ? console.debug(message) : console.debug(message, meta),
  info: (message, meta) =>
    meta === undefined ? console.info(message) : console.info(message, meta),
  warn: (message, meta) =>
    meta === undefined ? console.warn(message) : console.warn(message, meta),
  error: (message, meta) =>
    meta === undefined ? console.error(message) : console.error(message, meta),
};

function normalizeHeaderValue(value: string | null): string | null {
  const trimmed = value?.trim() || '';
  return trimmed ? trimmed : null;
}

function firstForwardedHost(value: string): string {
  const [first] = value.split(',');
  return (first || value).trim();
}

function hostFromUrl(url: string): string | null {
  try {
    return new URL(url).host || null;
  } catch {
    return null;
  }
}

function expectedHostFromRequest(request: Request): string | null {
  const host = normalizeHeaderValue(request.headers.get('host'));
  if (host) {
    return firstForwardedHost(host);
  }

  const urlHost = hostFromUrl(request.url);
  if (urlHost) {
    return urlHost;
  }

  const forwardedHost = normalizeHeaderValue(
    request.headers.get('x-forwarded-host')
  );
  return forwardedHost ? firstForwardedHost(forwardedHost) : null;
}

function appHost(): string | null {
  return hostFromUrl(site.brand.appUrl);
}

function sourceHostFromRequest(request: Request): string | null {
  const origin = normalizeHeaderValue(request.headers.get('origin'));
  if (origin && origin !== 'null') {
    return hostFromUrl(origin);
  }

  const referer = normalizeHeaderValue(request.headers.get('referer'));
  return referer ? hostFromUrl(referer) : null;
}

function assertCsrf(request: Request): void {
  if (!WRITE_METHODS.has(request.method.toUpperCase())) {
    return;
  }
  if (!request.headers.has('cookie')) {
    return;
  }

  const sourceHost = sourceHostFromRequest(request);
  if (!sourceHost) {
    throw new ForbiddenError('csrf check failed');
  }

  const allowedHosts = new Set<string>();
  const expectedHost = expectedHostFromRequest(request);
  if (expectedHost) {
    allowedHosts.add(expectedHost);
  }

  const configuredAppHost = appHost();
  if (configuredAppHost) {
    allowedHosts.add(configuredAppHost);
  }

  if (allowedHosts.size === 0 || !allowedHosts.has(sourceHost)) {
    throw new ForbiddenError('csrf check failed');
  }
}

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
  return {
    log: consoleLog,
    parseJson: (schema) => parseJson(request, schema),
    requireUser: () => requireUser(request),
  };
}
