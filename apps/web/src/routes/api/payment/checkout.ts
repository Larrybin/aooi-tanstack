import { createPaymentCheckoutSession } from '@/domains/billing/application/checkout';
import { createPaymentCheckoutPostAction } from '@/server/api/payment/checkout-action';
import { sitePricing } from '@/site';
import { createFileRoute } from '@tanstack/react-router';

import { assertPaymentCapabilityEnabled } from '@/config/payment-capability';
import { withApi } from '@/shared/lib/api/route';

import { createTanStackApiContext } from '../../../server/api-context';
import {
  readTanStackBillingRuntimeSettings,
  readTanStackPaymentRuntimeBindings,
} from '../../../server/billing-runtime';

const postPaymentCheckout = withApi(
  createPaymentCheckoutPostAction({
    requirePaymentCapability: assertPaymentCapabilityEnabled,
    createApiContext: createTanStackApiContext,
    sitePricing,
    readBillingRuntimeSettings: readTanStackBillingRuntimeSettings,
    getPaymentRuntimeBindings: readTanStackPaymentRuntimeBindings,
    createPaymentCheckoutSession,
  })
);

export const Route = createFileRoute('/api/payment/checkout')({
  server: {
    handlers: {
      POST: ({ request }) => postPaymentCheckout(request),
    },
  },
});
