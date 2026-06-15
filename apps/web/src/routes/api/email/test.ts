import { createEmailTestPostHandler } from '@/server/api/email/test-route';
import { createFileRoute } from '@tanstack/react-router';

import { buildVerificationCodeEmailPayload } from '@/shared/content/email/verification-code';
import { createLimiterFactory } from '@/shared/lib/api/limiters-factory';

import { createTanStackApiContext } from '../../../server/api-context';
import { withTanStackCloudflareBindings } from '../../../server/cloudflare-bindings';
import {
  createRuntimeRandomInt,
  createTanStackEmailService,
} from '../../../server/email-runtime';

const postEmailTest = withTanStackCloudflareBindings(
  createEmailTestPostHandler({
    getApiContext: createTanStackApiContext,
    getEmailService: createTanStackEmailService,
    buildVerificationCodeEmailPayload,
    quotaLimiter: createLimiterFactory().createEmailTestQuotaLimiter(),
    now: Date.now,
    randomInt: createRuntimeRandomInt,
  })
);

export const Route = createFileRoute('/api/email/test')({
  server: {
    handlers: {
      POST: ({ request }) => postEmailTest(request),
    },
  },
});
