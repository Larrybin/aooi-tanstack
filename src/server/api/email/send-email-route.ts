import type { EmailService } from '@/infra/adapters/email/service-builder';

import type { EmailSendResult } from '@/extensions/email';
import { PERMISSIONS } from '@/shared/constants/rbac-permissions';
import type { buildVerificationCodeEmailPayload as buildVerificationCodeEmailPayloadFn } from '@/shared/content/email/verification-code';
import {
  BadRequestError,
  TooManyRequestsError,
  UpstreamError,
} from '@/shared/lib/api/errors';
import { jsonOk } from '@/shared/lib/api/response';
import { withApi } from '@/shared/lib/api/route';
import { maskEmail, normalizeEmail } from '@/shared/lib/email';
import { EmailSendBodySchema } from '@/shared/schemas/api/email/send-email';
import type { z } from 'zod';

const MAX_EMAIL_RECIPIENTS = 10;

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

type SendEmailApiContext = EmailRouteApiContext;
type SendEmailService = EmailService;
type BuildVerificationCodeEmailPayload =
  typeof buildVerificationCodeEmailPayloadFn;

type SendEmailRouteDeps = {
  getApiContext: (req: Request) => MaybePromise<SendEmailApiContext>;
  getEmailService: () => Promise<SendEmailService>;
  persistSettingsEmailVerificationCode: (input: {
    userId: string;
    email: string;
    code: string;
  }) => Promise<{ id: string; identifier: string }>;
  deleteEmailVerificationCodeById: (id: string) => Promise<void>;
  deleteEmailVerificationCodesByIdentifierExceptId: (input: {
    identifier: string;
    keepId: string;
  }) => Promise<void>;
  buildVerificationCodeEmailPayload: (
    input: Parameters<BuildVerificationCodeEmailPayload>[0]
  ) => MaybePromise<ReturnType<BuildVerificationCodeEmailPayload>>;
  rateLimiter: {
    check: (
      key: string,
      now?: number
    ) => Promise<{
      allowed: boolean;
      retryAfterSeconds?: number;
    }>;
    consume: (key: string, now?: number) => Promise<number>;
    rollback: (key: string, consumedAt: number) => Promise<void>;
  };
  now: () => number;
  randomInt: (min: number, max: number) => number;
};

function uniqueNormalizedEmails(emails: string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const email of emails) {
    const normalized = normalizeEmail(email);
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    unique.push(normalized);
  }
  return unique;
}

function buildSendEmailPostLogic(deps: SendEmailRouteDeps) {
  return async (req: Request) => {
    const api = await deps.getApiContext(req);
    const { log } = api;
    const user = await api.requireUser();
    await api.requirePermission(user.id, PERMISSIONS.SETTINGS_WRITE);
    const { emails, subject } = await api.parseJson(EmailSendBodySchema);

    const recipientsRaw = Array.isArray(emails) ? emails : [emails];
    const recipients = uniqueNormalizedEmails(recipientsRaw);

    if (recipients.length > MAX_EMAIL_RECIPIENTS) {
      throw new BadRequestError(
        `too many recipients (max ${MAX_EMAIL_RECIPIENTS})`
      );
    }

    const now = deps.now();

    const throttled = recipients.map(async (email) => {
      const key = `${user.id}|${email}`;
      const throttleCheck = await deps.rateLimiter.check(key, now);
      if (throttleCheck.allowed) {
        return null;
      }
      return { email, retryAfterSeconds: throttleCheck.retryAfterSeconds ?? 1 };
    });
    const throttledResults = await Promise.all(throttled);
    const throttledEmails = throttledResults.filter(
      (
        x
      ): x is {
        email: string;
        retryAfterSeconds: number;
      } => x !== null
    );

    if (throttledEmails.length > 0) {
      const retryAfterSeconds = Math.max(
        ...throttledEmails.map((item) => item.retryAfterSeconds)
      );
      log.warn('[API] send email throttled', {
        userId: user.id,
        retryAfterSeconds,
      });
      throw new TooManyRequestsError('too many requests', {
        retryAfterSeconds,
      });
    }

    const emailService = await deps
      .getEmailService()
      .catch((error: unknown) => {
        log.error('[API] Email service init failed', { error });
        throw new UpstreamError(503, 'email service unavailable');
      });

    const results: Array<{ email: string; result: EmailSendResult }> = [];
    const isSingleRecipient = recipients.length === 1;

    for (const email of recipients) {
      const rateLimitKey = `${user.id}|${email}`;
      const consumedAt = await deps.rateLimiter.consume(rateLimitKey, now);

      const rollbackRateLimit = () => {
        return deps.rateLimiter.rollback(rateLimitKey, consumedAt);
      };

      const code = String(deps.randomInt(0, 1_000_000)).padStart(6, '0');

      let verification: { id: string; identifier: string } | null = null;
      try {
        verification = await deps.persistSettingsEmailVerificationCode({
          userId: user.id,
          email,
          code,
        });
      } catch (error: unknown) {
        await rollbackRateLimit();
        log.error('[API] persist verification code failed', {
          error,
          userId: user.id,
          email: maskEmail(email),
        });
        if (isSingleRecipient) {
          throw new UpstreamError(503, 'verification service unavailable');
        }
        results.push({
          email,
          result: {
            success: false,
            provider: 'unknown',
            error: 'verification service unavailable',
          },
        });
        continue;
      }

      let sendResult: EmailSendResult;
      try {
        sendResult = await emailService.sendEmail({
          to: email,
          subject,
          ...(await deps.buildVerificationCodeEmailPayload({ code })),
        });
      } catch (error: unknown) {
        await rollbackRateLimit();
        void deps
          .deleteEmailVerificationCodeById(verification.id)
          .catch((cleanupError: unknown) => {
            log.error('[API] rollback verification code failed', {
              cleanupError,
            });
          });
        log.error('[API] sendEmail threw', {
          error,
          userId: user.id,
          email: maskEmail(email),
        });
        if (isSingleRecipient) {
          throw new UpstreamError(503, 'email service unavailable');
        }
        results.push({
          email,
          result: {
            success: false,
            provider: 'unknown',
            error: 'email service unavailable',
          },
        });
        continue;
      }

      if (!sendResult.success) {
        await rollbackRateLimit();
        void deps
          .deleteEmailVerificationCodeById(verification.id)
          .catch((cleanupError: unknown) => {
            log.error('[API] rollback verification code failed', {
              cleanupError,
            });
          });
        log.error('[API] sendEmail failed', {
          provider: sendResult.provider,
          error: sendResult.error,
          userId: user.id,
          email: maskEmail(email),
        });
        if (isSingleRecipient) {
          throw new UpstreamError(502, 'send email failed');
        }
        results.push({ email, result: sendResult });
        continue;
      }

      void deps
        .deleteEmailVerificationCodesByIdentifierExceptId({
          identifier: verification.identifier,
          keepId: verification.id,
        })
        .catch((cleanupError: unknown) => {
          log.error('[API] cleanup verification codes failed', {
            cleanupError,
            userId: user.id,
          });
        });

      results.push({ email, result: sendResult });
    }

    const anySuccess = results.some((item) => item.result.success);
    const provider =
      results.find((item) => item.result.success)?.result.provider ?? 'unknown';
    const messageId = results.find((item) => item.result.success)?.result
      .messageId;

    log.debug('send email result', {
      emailCount: recipients.length,
      success: anySuccess,
      provider,
      messageId,
      failures: results.filter((item) => !item.result.success).length,
    });

    if (isSingleRecipient) {
      return jsonOk(
        results[0]?.result ?? { success: false, provider: 'unknown' }
      );
    }

    return jsonOk({
      success: anySuccess,
      provider,
      messageId,
      results: results.map(({ email, result }) => ({ email, ...result })),
    });
  };
}

export function createSendEmailPostHandler(deps: SendEmailRouteDeps) {
  return withApi(buildSendEmailPostLogic(deps));
}
