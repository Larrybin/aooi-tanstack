import { createApiContext } from '@/app/api/_lib/context';
import { consumeSettingsEmailVerificationCode } from '@/domains/account/infra/email-verification-code';
import { createVerifyCodePostHandler } from '@/server/api/email/verify-code-route';

import { createLimiterFactory } from '@/shared/lib/api/limiters-factory';

export const POST = createVerifyCodePostHandler({
  getApiContext: createApiContext,
  consumeSettingsEmailVerificationCode,
  attemptLimiter: createLimiterFactory().createVerifyCodeAttemptLimiter(),
  now: Date.now,
});
