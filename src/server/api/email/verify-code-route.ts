import { PERMISSIONS } from '@/shared/constants/rbac-permissions';
import { BadRequestError, TooManyRequestsError } from '@/shared/lib/api/errors';
import { jsonOk } from '@/shared/lib/api/response';
import { withApi } from '@/shared/lib/api/route';
import { maskEmail, normalizeEmail } from '@/shared/lib/email';
import { EmailVerifyCodeBodySchema } from '@/shared/schemas/api/email/verify-code';
import type { z } from 'zod';

type MaybePromise<T> = T | Promise<T>;
type EmailRouteLog = {
  debug(message: string, meta?: unknown): void;
  info(message: string, meta?: unknown): void;
  warn(message: string, meta?: unknown): void;
  error(message: string, meta?: unknown): void;
};

type EmailRouteApiContext = {
  log: EmailRouteLog;
  parseJson: <TSchema extends z.ZodTypeAny>(
    schema: TSchema
  ) => Promise<z.infer<TSchema>>;
  requireUser: () => Promise<{ id: string }>;
  requirePermission: (userId: string, code: string) => Promise<void>;
};

type VerifyCodeApiContext = EmailRouteApiContext;

type VerifyCodeRouteDeps = {
  getApiContext: (req: Request) => MaybePromise<VerifyCodeApiContext>;
  consumeSettingsEmailVerificationCode: (input: {
    userId: string;
    email: string;
    code: string;
  }) => Promise<
    { ok: true } | { ok: false; reason: 'not_found' | 'expired' | 'mismatch' }
  >;
  attemptLimiter: {
    check: (
      key: string,
      now?: number
    ) => Promise<{
      allowed: boolean;
      retryAfterSeconds?: number;
    }>;
    recordFailure: (
      key: string,
      now?: number
    ) => Promise<{ attempts: number; retryAfterSeconds?: number }>;
    clear: (key: string) => Promise<void>;
  };
  now: () => number;
};

function buildVerifyIdentifier(userId: string, email: string): string {
  return `${userId}|${normalizeEmail(email)}`;
}

export function createVerifyCodePostHandler(deps: VerifyCodeRouteDeps) {
  return withApi(buildVerifyCodePostLogic(deps));
}

function buildVerifyCodePostLogic(deps: VerifyCodeRouteDeps) {
  return async (req: Request) => {
    const api = await deps.getApiContext(req);
    const { log } = api;
    const user = await api.requireUser();
    await api.requirePermission(user.id, PERMISSIONS.SETTINGS_WRITE);

    const { email, code } = await api.parseJson(EmailVerifyCodeBodySchema);
    const now = deps.now();

    const verifyKey = buildVerifyIdentifier(user.id, email);
    const existing = await deps.attemptLimiter.check(verifyKey, now);
    if (!existing.allowed) {
      throw new TooManyRequestsError('too many attempts', {
        retryAfterSeconds: existing.retryAfterSeconds,
      });
    }

    const result = await deps.consumeSettingsEmailVerificationCode({
      userId: user.id,
      email,
      code,
    });

    if (!result.ok) {
      const attempt = await deps.attemptLimiter.recordFailure(verifyKey, now);
      const retryAfterSeconds = attempt.retryAfterSeconds;

      log.warn('[API] verify email code failed', {
        userId: user.id,
        email: maskEmail(email),
        reason: result.reason,
        attempts: attempt.attempts,
      });

      if (retryAfterSeconds) {
        throw new TooManyRequestsError('too many attempts', {
          retryAfterSeconds,
        });
      }

      if (result.reason === 'expired') {
        throw new BadRequestError('verification code expired');
      }

      throw new BadRequestError('invalid verification code');
    }

    await deps.attemptLimiter.clear(verifyKey);

    log.info('[API] verify email code ok', {
      userId: user.id,
      email: maskEmail(email),
    });
    return jsonOk({ verified: true });
  };
}
