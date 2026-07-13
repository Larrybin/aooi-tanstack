import { createFileRoute } from '@tanstack/react-router';

import {
  getPaymentCallback,
  postPaymentCallback,
} from '../../../server/handlers/payment';

export const Route = createFileRoute('/api/payment/callback')({
  server: {
    handlers: {
      GET: ({ request }) => getPaymentCallback(request),
      POST: ({ request }) => postPaymentCallback(request),
    },
  },
});
