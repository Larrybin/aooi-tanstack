import { randomInt } from 'crypto';
import { createApiContext } from '@/app/api/_lib/context';
import {
  deleteEmailVerificationCodeById,
  deleteEmailVerificationCodesByIdentifierExceptId,
  persistSettingsEmailVerificationCode,
} from '@/domains/account/infra/email-verification-code';
import { getEmailService } from '@/infra/adapters/email/service';
import { createSendEmailPostHandler } from '@/server/api/email/send-email-route';

import { buildVerificationCodeEmailPayload } from '@/shared/content/email/verification-code';
import { createLimiterFactory } from '@/shared/lib/api/limiters-factory';

export const POST = createSendEmailPostHandler({
  getApiContext: createApiContext,
  getEmailService,
  persistSettingsEmailVerificationCode,
  deleteEmailVerificationCodeById,
  deleteEmailVerificationCodesByIdentifierExceptId,
  buildVerificationCodeEmailPayload,
  rateLimiter: createLimiterFactory().createSendEmailCooldownLimiter(),
  now: Date.now,
  randomInt,
});
