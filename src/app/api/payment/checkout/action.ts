import {
  findPricingItemByProductId,
  isPricingItemCheckoutEnabled,
} from '@/domains/billing/domain/pricing';

import { BadRequestError, NotFoundError } from '@/shared/lib/api/errors';
import { jsonOk } from '@/shared/lib/api/response';
import { PaymentCheckoutBodySchema } from '@/shared/schemas/api/payment/checkout';
import type { SitePricing } from '@/shared/types/blocks/pricing';

type CheckoutApiContext = {
  log: {
    debug(message: string, meta?: unknown): void;
    info(message: string, meta?: unknown): void;
    warn(message: string, meta?: unknown): void;
    error(message: string, meta?: unknown): void;
  };
  parseJson(schema: typeof PaymentCheckoutBodySchema): Promise<{
    product_id: string;
    currency?: string;
    locale?: string;
  }>;
  requireUser(): Promise<{ id: string; email?: string | null; name?: string | null }>;
};

type CheckoutPostActionDeps<TSettings, TBindings> = {
  requirePaymentCapability: () => void;
  createApiContext: (req: Request) => CheckoutApiContext;
  sitePricing: SitePricing | null;
  readBillingRuntimeSettings: () => Promise<TSettings>;
  getPaymentRuntimeBindings: () => TBindings;
  createPaymentCheckoutSession: (input: {
    pricingItem: NonNullable<SitePricing['pricing']['items']>[number];
    user: { id: string; email?: string | null; name?: string | null };
    settings: TSettings;
    bindings: TBindings;
    currency: string | undefined;
    locale: string | undefined;
    log: CheckoutApiContext['log'];
  }) => Promise<unknown>;
};

export function createPaymentCheckoutPostAction<TSettings, TBindings>(
  deps: CheckoutPostActionDeps<TSettings, TBindings>
) {
  return async (req: Request) => {
    deps.requirePaymentCapability();
    const api = deps.createApiContext(req);
    const { log } = api;
    const { product_id, currency, locale } = await api.parseJson(
      PaymentCheckoutBodySchema
    );

    if (!deps.sitePricing) {
      throw new NotFoundError('pricing is not configured');
    }

    const pricingItem = findPricingItemByProductId(
      deps.sitePricing.pricing,
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
      deps.readBillingRuntimeSettings(),
      Promise.resolve(deps.getPaymentRuntimeBindings()),
    ]);

    const checkoutInfo = await deps.createPaymentCheckoutSession({
      pricingItem,
      user,
      settings,
      bindings,
      currency,
      locale,
      log,
    });

    return jsonOk(checkoutInfo);
  };
}
