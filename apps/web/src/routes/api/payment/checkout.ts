import { createPaymentCheckoutSession } from '@/domains/billing/application/checkout';
import {
  findPricingItemByProductId,
  isPricingItemCheckoutEnabled,
} from '@/domains/billing/domain/pricing';
import { readBillingRuntimeSettingsCached } from '@/domains/settings/application/settings-runtime.query';
import { getPaymentRuntimeBindings } from '@/infra/adapters/payment/runtime-bindings';
import { sitePricing } from '@/site';
import { createFileRoute } from '@tanstack/react-router';

import { assertPaymentCapabilityEnabled } from '@/config/payment-capability';
import { BadRequestError, NotFoundError } from '@/shared/lib/api/errors';
import { jsonOk } from '@/shared/lib/api/response';
import { withApi } from '@/shared/lib/api/route';
import { PaymentCheckoutBodySchema } from '@/shared/schemas/api/payment/checkout';

import { createTanStackApiContext } from '../../../server/api-context';

const postPaymentCheckout = withApi(async (request: Request) => {
  assertPaymentCapabilityEnabled();

  const api = createTanStackApiContext(request);
  const { product_id, currency, locale } = await api.parseJson(
    PaymentCheckoutBodySchema
  );

  if (!sitePricing) {
    throw new NotFoundError('pricing is not configured');
  }

  const pricingItem = findPricingItemByProductId(
    sitePricing.pricing,
    product_id
  );

  if (!pricingItem) {
    throw new NotFoundError('pricing item not found');
  }

  if (!isPricingItemCheckoutEnabled(pricingItem)) {
    throw new BadRequestError('pricing item is not available for checkout');
  }

  if (!pricingItem.product_id || pricingItem.amount <= 0) {
    throw new BadRequestError('invalid pricing item');
  }

  const user = await api.requireUser();
  const [settings, bindings] = await Promise.all([
    readBillingRuntimeSettingsCached(),
    Promise.resolve(getPaymentRuntimeBindings()),
  ]);

  const checkoutInfo = await createPaymentCheckoutSession({
    pricingItem,
    user,
    settings,
    bindings,
    currency,
    locale,
    log: api.log,
  });

  return jsonOk(checkoutInfo);
});

export const Route = createFileRoute('/api/payment/checkout')({
  server: {
    handlers: {
      POST: ({ request }) => postPaymentCheckout(request),
    },
  },
});
