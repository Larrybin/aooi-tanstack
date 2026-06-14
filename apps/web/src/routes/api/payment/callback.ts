import { handleCheckoutSuccess } from '@/domains/billing/application/flows';
import { findOrderByOrderNo } from '@/domains/billing/infra/order';
import { getPaymentService } from '@/infra/adapters/payment/service';
import { createPaymentCallbackPostAction } from '@/server/api/payment/callback-action';
import { createFileRoute } from '@tanstack/react-router';

import { assertPaymentCapabilityEnabled } from '@/config/payment-capability';
import { withApi } from '@/shared/lib/api/route';
import { resolveConfigConsistencyMode } from '@/shared/lib/config-consistency';

import { createTanStackApiContext } from '../../../server/api-context';
import {
  readTanStackBillingRuntimeSettings,
  readTanStackPaymentRuntimeBindings,
} from '../../../server/billing-runtime';

const postPaymentCallback = withApi(
  createPaymentCallbackPostAction({
    requirePaymentCapability: assertPaymentCapabilityEnabled,
    createApiContext: createTanStackApiContext,
    findOrderByOrderNo,
    readBillingRuntimeSettingsCached: readTanStackBillingRuntimeSettings,
    readBillingRuntimeSettingsFresh: readTanStackBillingRuntimeSettings,
    getPaymentRuntimeBindings: readTanStackPaymentRuntimeBindings,
    createPaymentService: async ({ settings, bindings }) =>
      await getPaymentService({ settings, bindings }),
    handleCheckoutSuccess,
    resolveMode: resolveConfigConsistencyMode,
  })
);

export const Route = createFileRoute('/api/payment/callback')({
  server: {
    handlers: {
      POST: ({ request }) => postPaymentCallback(request),
    },
  },
});
