import {
  deleteEmailVerificationCodeById,
  deleteEmailVerificationCodesByIdentifierExceptId,
  persistSettingsEmailVerificationCode,
} from '@/domains/account/infra/email-verification-code';
import { createSendEmailPostHandler } from '@/server/api/email/send-email-route';
import { createFileRoute } from '@tanstack/react-router';

import { buildVerificationCodeEmailPayload } from '@/shared/content/email/verification-code';
import { createLimiterFactory } from '@/shared/lib/api/limiters-factory';

import { createTanStackApiContext } from '../../../server/api-context';
import { withTanStackCloudflareBindings } from '../../../server/cloudflare-bindings';
import {
  createRuntimeRandomInt,
  createTanStackEmailService,
} from '../../../server/email-runtime';

const postSendEmail = withTanStackCloudflareBindings(
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

export const Route = createFileRoute('/api/email/send-email')({
  server: {
    handlers: {
      POST: ({ request }) => postSendEmail(request),
    },
  },
});
