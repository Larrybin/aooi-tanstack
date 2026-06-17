import { handleCheckoutSuccess } from '@/domains/billing/application/flows';
import {
  resolvePaymentCallbackPricingFallbackUrl,
  resolvePaymentCallbackRedirectQuery,
} from '@/domains/billing/application/payment-callback';
import { findOrderByOrderNo } from '@/domains/billing/infra/order';
import { getPaymentService } from '@/infra/adapters/payment/service';
import { getSignedInUserIdentityFromRequest } from '@/infra/platform/auth/session-by-request';
import { getRequestLogger } from '@/infra/platform/logging/request-logger.server';
import { createPaymentCallbackPostAction } from '@/server/api/payment/callback-action';
import { createFileRoute } from '@tanstack/react-router';

import { assertPaymentCapabilityEnabled } from '@/config/payment-capability';
import { withApi } from '@/shared/lib/api/route';
import { resolveConfigConsistencyMode } from '@/shared/lib/config-consistency';
import { PaymentCallbackQuerySchema } from '@/shared/schemas/api/payment/callback';

import { createTanStackApiContext } from '../../../server/api-context';
import {
  readTanStackBillingRuntimeSettings,
  readTanStackPaymentRuntimeBindings,
} from '../../../server/billing-runtime';
import { withTanStackCloudflareBindings } from '../../../server/cloudflare-bindings';

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
const postPaymentCallbackWithBindings =
  withTanStackCloudflareBindings(postPaymentCallback);

const getPaymentCallbackWithBindings = withTanStackCloudflareBindings(
  async (request: Request) => {
    assertPaymentCapabilityEnabled();
    const { log } = getRequestLogger(request);
    let redirectUrl: string;

    try {
      const parsedQuery = PaymentCallbackQuerySchema.parse(
        Object.fromEntries(new URL(request.url).searchParams)
      );
      const user = await getSignedInUserIdentityFromRequest(request);
      if (!user) {
        throw new Error('payment callback requires a signed-in user');
      }
      redirectUrl = await resolvePaymentCallbackRedirectQuery(
        {
          orderNo: parsedQuery.order_no,
          actorUserId: user.id,
          log,
        },
        {
          readBillingRuntimeSettingsCached: readTanStackBillingRuntimeSettings,
          findOrderByOrderNo,
        }
      );
    } catch (error) {
      log.error('payment: callback get fallback to pricing', { error });
      redirectUrl = await resolvePaymentCallbackPricingFallbackUrl({
        readBillingRuntimeSettingsCached: readTanStackBillingRuntimeSettings,
      });
    }

    return Response.redirect(redirectUrl, 307);
  }
);

export const Route = createFileRoute('/api/payment/callback')({
  server: {
    handlers: {
      GET: ({ request }) => getPaymentCallbackWithBindings(request),
      POST: ({ request }) => postPaymentCallbackWithBindings(request),
    },
  },
});
