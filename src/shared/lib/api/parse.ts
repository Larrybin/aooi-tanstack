/**
 * Usage:
 * - `parseJson(req, Schema)` for JSON body.
 * - `parseQuery(req.url, Schema)` for URL query params.
 * - `parseParams(paramsPromise, Schema)` for route params provided as a Promise.
 */

import { getRequestLogger } from '@/infra/platform/logging/request-logger.server';
import type { z } from 'zod';

import { tryJsonParse } from '@/shared/lib/json';
import { readRequestTextWithLimit } from '@/shared/lib/runtime/request-body';

import { BadRequestError, PayloadTooLargeError } from './errors';

function isAbortError(error: unknown): boolean {
  if (
    typeof DOMException !== 'undefined' &&
    error instanceof DOMException &&
    error.name
  ) {
    return error.name === 'AbortError';
  }

  if (error instanceof Error) {
    return error.name === 'AbortError';
  }

  return false;
}

const DEFAULT_JSON_BODY_LIMIT_BYTES = 1024 * 1024; // 1MB

function parseContentLengthHeader(value: string | null): number | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
}

export async function parseJson<TSchema extends z.ZodTypeAny>(
  req: Request,
  schema: TSchema
): Promise<z.infer<TSchema>> {
  let rawText = '';
  try {
    const limitBytes = DEFAULT_JSON_BODY_LIMIT_BYTES;
    const contentLength = parseContentLengthHeader(
      req.headers.get('content-length')
    );
    if (contentLength !== null && contentLength > limitBytes) {
      throw new PayloadTooLargeError('payload too large');
    }

    rawText = await readRequestTextWithLimit(req, limitBytes);
  } catch (error: unknown) {
    const { log } = getRequestLogger(req);

    if (error instanceof PayloadTooLargeError) {
      const limitBytes = DEFAULT_JSON_BODY_LIMIT_BYTES;
      const contentLength = parseContentLengthHeader(
        req.headers.get('content-length')
      );
      log.warn('api: request body too large', { contentLength, limitBytes });
      throw error;
    }

    if (isAbortError(error)) {
      log.debug('api: request body read aborted', { error });
    } else {
      log.error('api: failed to read request body', { error });
    }

    throw new BadRequestError('invalid json body');
  }
  const parsed = tryJsonParse<unknown>(rawText);
  if (!parsed.ok) {
    throw new BadRequestError('invalid json body');
  }
  const value: unknown = parsed.value;

  const result = schema.safeParse(value);
  if (!result.success) {
    throw new BadRequestError('invalid request params', {
      issues: result.error.issues,
    });
  }

  return result.data;
}

export function parseQuery<TSchema extends z.ZodTypeAny>(
  url: string,
  schema: TSchema
): z.infer<TSchema> {
  const { searchParams } = new URL(url);
  const value = Object.fromEntries(searchParams.entries());

  const result = schema.safeParse(value);
  if (!result.success) {
    throw new BadRequestError('invalid request params', {
      issues: result.error.issues,
    });
  }

  return result.data;
}

export async function parseParams<TSchema extends z.ZodTypeAny>(
  paramsPromise: Promise<unknown>,
  schema: TSchema
): Promise<z.infer<TSchema>> {
  const params = await paramsPromise;
  const result = schema.safeParse(params);
  if (!result.success) {
    throw new BadRequestError('invalid route params', {
      issues: result.error.issues,
    });
  }
  return result.data;
}
