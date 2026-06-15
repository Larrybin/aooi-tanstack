
import type { PaymentRuntimeBindings } from '@/domains/settings/application/settings-runtime.contracts';
import {
  getRuntimeEnvString,
  type CloudflareBindings,
} from '@/infra/runtime/env.server';

import {
  assertPaymentCapabilityContract,
  resolveSitePaymentCapability,
} from '@/config/payment-capability';

type PaymentRuntimeBindingOptions = {
  bindings?: CloudflareBindings | null;
};

function readPaymentRuntimeBindings(
  options: PaymentRuntimeBindingOptions = {}
): PaymentRuntimeBindings {
  const capability = resolveSitePaymentCapability();

  switch (capability) {
    case 'none':
      return {
        provider: 'none',
        paymentCapability: 'none',
      };
    case 'stripe': {
      const bindings = {
        stripePublishableKey:
          getRuntimeEnvString('STRIPE_PUBLISHABLE_KEY', options)?.trim() || '',
        stripeSecretKey:
          getRuntimeEnvString('STRIPE_SECRET_KEY', options)?.trim() || '',
        stripeSigningSecret:
          getRuntimeEnvString('STRIPE_SIGNING_SECRET', options)?.trim() || '',
      };
      assertPaymentCapabilityContract({
        capability,
        settings: {},
        bindings,
      });
      return {
        provider: 'stripe',
        paymentCapability: 'stripe',
        ...bindings,
      };
    }
    case 'creem': {
      const bindings = {
        creemApiKey:
          getRuntimeEnvString('CREEM_API_KEY', options)?.trim() || '',
        creemSigningSecret:
          getRuntimeEnvString('CREEM_SIGNING_SECRET', options)?.trim() || '',
      };
      assertPaymentCapabilityContract({
        capability,
        settings: {},
        bindings,
      });
      return {
        provider: 'creem',
        paymentCapability: 'creem',
        ...bindings,
      };
    }
    case 'paypal': {
      const bindings = {
        paypalClientId:
          getRuntimeEnvString('PAYPAL_CLIENT_ID', options)?.trim() || '',
        paypalClientSecret:
          getRuntimeEnvString('PAYPAL_CLIENT_SECRET', options)?.trim() || '',
        paypalWebhookId:
          getRuntimeEnvString('PAYPAL_WEBHOOK_ID', options)?.trim() || '',
      };
      assertPaymentCapabilityContract({
        capability,
        settings: {},
        bindings,
      });
      return {
        provider: 'paypal',
        paymentCapability: 'paypal',
        ...bindings,
      };
    }
  }
}

export function getPaymentRuntimeBindings(
  options: PaymentRuntimeBindingOptions = {}
): PaymentRuntimeBindings {
  return { ...readPaymentRuntimeBindings(options) };
}
