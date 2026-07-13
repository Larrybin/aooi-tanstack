import { createFileRoute } from '@tanstack/react-router';

import { postPaymentNotify } from '../../../server/handlers/payment';

export const Route = createFileRoute('/api/payment/notify')({
  server: {
    handlers: {
      POST: ({ request }) => postPaymentNotify(request),
    },
  },
});
