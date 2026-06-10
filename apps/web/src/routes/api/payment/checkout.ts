import { createPaymentCheckoutPostAction } from '@/app/api/payment/checkout/action';
import { createPaymentCheckoutSession } from '@/domains/billing/application/checkout';
import { getPaymentRuntimeBindings } from '@/infra/adapters/payment/runtime-bindings';
import { sitePricing } from '@/site';
import { createFileRoute } from '@tanstack/react-router';

import { assertPaymentCapabilityEnabled } from '@/config/payment-capability';
import { withApi } from '@/shared/lib/api/route';

import { createTanStackApiContext } from '../../../server/api-context';
import { readTanStackBillingRuntimeSettings } from '../../../server/billing-runtime';

const postPaymentCheckout = withApi(
  createPaymentCheckoutPostAction({
    requirePaymentCapability: assertPaymentCapabilityEnabled,
    createApiContext: createTanStackApiContext,
    sitePricing,
    readBillingRuntimeSettings: readTanStackBillingRuntimeSettings,
    getPaymentRuntimeBindings,
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
