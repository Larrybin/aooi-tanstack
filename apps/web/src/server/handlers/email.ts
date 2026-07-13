import {
  consumeSettingsEmailVerificationCode,
  deleteEmailVerificationCodeById,
  deleteEmailVerificationCodesByIdentifierExceptId,
  persistSettingsEmailVerificationCode,
} from '@/domains/account/infra/email-verification-code';
import { createSendEmailPostHandler } from '@/server/api/email/send-email-route';
import { createVerifyCodePostHandler } from '@/server/api/email/verify-code-route';

import { buildVerificationCodeEmailPayload } from '@/shared/content/email/verification-code';
import { createLimiterFactory } from '@/shared/lib/api/limiters-factory';

import { createTanStackApiContext } from '../api-context';
import { withTanStackCloudflareBindings } from '../cloudflare-bindings';
import {
  createRuntimeRandomInt,
  createTanStackEmailService,
} from '../email-runtime';

export const postSendEmail = withTanStackCloudflareBindings(
  createSendEmailPostHandler({
    getApiContext: createTanStackApiContext,
    getEmailService: createTanStackEmailService,
    persistSettingsEmailVerificationCode,
    deleteEmailVerificationCodeById,
    deleteEmailVerificationCodesByIdentifierExceptId,
    buildVerificationCodeEmailPayload,
    rateLimiter: createLimiterFactory().createSendEmailCooldownLimiter(),
    now: Date.now,
    randomInt: createRuntimeRandomInt,
  })
);

export const postVerifyCode = withTanStackCloudflareBindings(
  createVerifyCodePostHandler({
    getApiContext: createTanStackApiContext,
    consumeSettingsEmailVerificationCode,
    attemptLimiter: createLimiterFactory().createVerifyCodeAttemptLimiter(),
    now: Date.now,
  })
);
