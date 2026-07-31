import { createFileRoute } from '@tanstack/react-router';

import { postSendEmail } from '../../../../server/handlers/email';

export const Route = createFileRoute(
  '/(module_customer_service)/api/email/send-email'
)({
  server: {
    handlers: {
      POST: ({ request }) => postSendEmail(request),
    },
  },
});
