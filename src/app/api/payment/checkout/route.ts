import { createApiContext } from '@/app/api/_lib/context';
import { requirePaymentCapability } from '@/app/api/payment/_lib/guard';
import { createPaymentCheckoutSession } from '@/domains/billing/application/checkout';
import { readBillingRuntimeSettingsCached } from '@/domains/settings/application/settings-runtime.query';
import { getPaymentRuntimeBindings } from '@/infra/adapters/payment/runtime-bindings';
import { createPaymentCheckoutPostAction } from '@/server/api/payment/checkout-action';
import { sitePricing } from '@/site';

import { withApi } from '@/shared/lib/api/route';

export const POST = withApi(
  createPaymentCheckoutPostAction({
    requirePaymentCapability,
    createApiContext,
    sitePricing,
    readBillingRuntimeSettings: readBillingRuntimeSettingsCached,
    getPaymentRuntimeBindings,
    createPaymentCheckoutSession,
  })
);
