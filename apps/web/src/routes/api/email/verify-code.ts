import { consumeSettingsEmailVerificationCode } from '@/domains/account/infra/email-verification-code';
import { createVerifyCodePostHandler } from '@/server/api/email/verify-code-route';
import { createFileRoute } from '@tanstack/react-router';

import { createLimiterFactory } from '@/shared/lib/api/limiters-factory';

import { createTanStackApiContext } from '../../../server/api-context';
import { withTanStackCloudflareBindings } from '../../../server/cloudflare-bindings';

const postVerifyCode = withTanStackCloudflareBindings(
  createVerifyCodePostHandler({
    getApiContext: createTanStackApiContext,
    consumeSettingsEmailVerificationCode,
    attemptLimiter: createLimiterFactory().createVerifyCodeAttemptLimiter(),
    now: Date.now,
  })
);

export const Route = createFileRoute('/api/email/verify-code')({
  server: {
    handlers: {
      POST: ({ request }) => postVerifyCode(request),
    },
  },
});
