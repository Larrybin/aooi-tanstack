import { createFileRoute } from '@tanstack/react-router';

import { postVerifyCode } from '../../../server/handlers/email';

export const Route = createFileRoute('/api/email/verify-code')({
  server: {
    handlers: {
      POST: ({ request }) => postVerifyCode(request),
    },
  },
});
