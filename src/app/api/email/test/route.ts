import { randomInt } from 'crypto';
import { createApiContext } from '@/app/api/_lib/context';
import { getEmailService } from '@/infra/adapters/email/service';
import { createEmailTestPostHandler } from '@/server/api/email/test-route';

import { buildVerificationCodeEmailPayload } from '@/shared/content/email/verification-code';
import { createLimiterFactory } from '@/shared/lib/api/limiters-factory';

export const POST = createEmailTestPostHandler({
  getApiContext: createApiContext,
  getEmailService,
  buildVerificationCodeEmailPayload,
  quotaLimiter: createLimiterFactory().createEmailTestQuotaLimiter(),
  now: Date.now,
  randomInt,
});
