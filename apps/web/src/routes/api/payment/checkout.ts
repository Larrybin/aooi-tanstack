import { createFileRoute } from '@tanstack/react-router';

import { postPaymentCheckout } from '../../../server/handlers/payment';

export const Route = createFileRoute('/api/payment/checkout')({
  server: {
    handlers: {
      POST: ({ request }) => postPaymentCheckout(request),
    },
  },
});
