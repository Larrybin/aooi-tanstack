/* eslint-disable no-console */

import { isDebugEnv, isProductionEnv } from '@/shared/lib/env';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';
type BoundLogger = {
  debug: (message: string, meta?: unknown) => void;
  info: (message: string, meta?: unknown) => void;
  warn: (message: string, meta?: unknown) => void;
  error: (message: string, meta?: unknown) => void;
};

type UseCaseLoggerContext = {
  requestId?: string;
  domain: string;
  useCase: string;
  operation?: string;
};

const isProduction = isProductionEnv();
const isDebugEnabled = isDebugEnv();

const DEFAULT_MAX_DEPTH = 6;
const DEFAULT_MAX_ARRAY_LENGTH = 50;
const REDACTED = '[REDACTED]';

const sensitiveKeyMatchers: Array<(key: string) => boolean> = [
  (key) => key === 'authorization',
  (key) => key === 'cookie' || key === 'set-cookie',
  (key) => key.includes('password') || key === 'pwd' || key === 'pass',
  (key) => key.includes('secret'),
  (key) => key.includes('token'),
  (key) =>
    key.includes('api_key') || key.includes('apikey') || key === 'api-key',
  (key) => key.includes('client_secret'),
  (key) => key.includes('private_key'),
  (key) => key.includes('session') && key.endsWith('id'),
];

function isSensitiveKey(key: string): boolean {
  const normalized = key.trim().toLowerCase();
  if (!normalized) return false;
  return sensitiveKeyMatchers.some((match) => match(normalized));
}

function shouldLog(level: LogLevel): boolean {
  if (level === 'error') return true;
  if (level === 'debug') return isDebugEnabled;
  return !isProduction || isDebugEnabled;
}

function serializeError(error: Error): Record<string, unknown> {
  const base: Record<string, unknown> = {
    name: error.name,
    message: error.message,
  };

  if (!isProduction || isDebugEnabled) {
    base.stack = error.stack;
  }

  const cause = (error as Error & { cause?: unknown }).cause;
  if (cause instanceof Error) {
    base.cause = serializeError(cause);
  } else if (cause !== undefined) {
    base.cause = cause;
  }

  return base;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object') return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function mergeMeta(context: unknown, meta: unknown): unknown {
  if (meta === undefined) return context;
  if (context === undefined) return meta;

  if (isPlainObject(context) && isPlainObject(meta)) {
    return { ...context, ...meta };
  }

  return { ctx: context, meta };
}

function redactInternal(
  value: unknown,
  seen: WeakSet<object>,
  depth: number,
  maxDepth: number,
  maxArrayLength: number
): unknown {
  if (value === null || value === undefined) return value;
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value;
  }
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'symbol') return value.toString();
  if (typeof value === 'function') return '[Function]';

  if (depth >= maxDepth) return '[Truncated]';

  if (value instanceof Error) {
    return redactInternal(
      serializeError(value),
      seen,
      depth + 1,
      maxDepth,
      maxArrayLength
    );
  }

  if (value instanceof Date) return value.toISOString();

  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(value)) {
    return `[Buffer ${(value as Buffer).length} bytes]`;
  }
  if (value instanceof Uint8Array) {
    return `[Uint8Array ${value.byteLength} bytes]`;
  }

  if (Array.isArray(value)) {
    const out: unknown[] = [];
    const len = Math.min(value.length, maxArrayLength);
    for (let i = 0; i < len; i++) {
      out.push(
        redactInternal(value[i], seen, depth + 1, maxDepth, maxArrayLength)
      );
    }
    if (value.length > len) {
      out.push(`[+${value.length - len} more items]`);
    }
    return out;
  }

  if (typeof value === 'object') {
    if (seen.has(value as object)) return '[Circular]';
    seen.add(value as object);

    if (!isPlainObject(value)) {
      try {
        return redactInternal(
          JSON.parse(JSON.stringify(value)),
          seen,
          depth + 1,
          maxDepth,
          maxArrayLength
        );
      } catch {
        return '[Unserializable]';
      }
    }

    const out: Record<string, unknown> = {};
    for (const [rawKey, rawVal] of Object.entries(value)) {
      if (isSensitiveKey(rawKey)) {
        out[rawKey] = REDACTED;
        continue;
      }
      out[rawKey] = redactInternal(
        rawVal,
        seen,
        depth + 1,
        maxDepth,
        maxArrayLength
      );
    }
    return out;
  }

  return '[Unknown]';
}

export function redact(
  value: unknown,
  options?: { maxDepth?: number; maxArrayLength?: number }
): unknown {
  const maxDepth = options?.maxDepth ?? DEFAULT_MAX_DEPTH;
  const maxArrayLength = options?.maxArrayLength ?? DEFAULT_MAX_ARRAY_LENGTH;

  try {
    return redactInternal(
      value,
      new WeakSet<object>(),
      0,
      maxDepth,
      maxArrayLength
    );
  } catch {
    return '[RedactionFailed]';
  }
}

function emit(level: LogLevel, message: string, meta?: unknown) {
  if (!shouldLog(level)) return;

  const payload = meta === undefined ? undefined : redact(meta);

  const sink =
    level === 'error'
      ? console.error
      : level === 'warn'
        ? console.warn
        : level === 'info'
          ? console.info
          : console.debug;

  if (payload === undefined) {
    sink(message);
    return;
  }

  sink(message, payload);
}

export const logger = {
  debug(message: string, meta?: unknown) {
    emit('debug', message, meta);
  },
  info(message: string, meta?: unknown) {
    emit('info', message, meta);
  },
  warn(message: string, meta?: unknown) {
    emit('warn', message, meta);
  },
  error(message: string, meta?: unknown) {
    emit('error', message, meta);
  },
  with(context: unknown) {
    return {
      debug(message: string, meta?: unknown) {
        emit('debug', message, mergeMeta(context, meta));
      },
      info(message: string, meta?: unknown) {
        emit('info', message, mergeMeta(context, meta));
      },
      warn(message: string, meta?: unknown) {
        emit('warn', message, mergeMeta(context, meta));
      },
      error(message: string, meta?: unknown) {
        emit('error', message, mergeMeta(context, meta));
      },
    };
  },
};

export function createUseCaseLogger(
  context: UseCaseLoggerContext
): BoundLogger {
  const { requestId, domain, useCase, operation } = context;
  return logger.with({
    ...(requestId ? { requestId } : {}),
    domain,
    useCase,
    ...(operation ? { operation } : {}),
  });
}
