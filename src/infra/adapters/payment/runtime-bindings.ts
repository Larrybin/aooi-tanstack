import 'server-only';

import type { PaymentRuntimeBindings } from '@/domains/settings/application/settings-runtime.contracts';
import { getRuntimeEnvString } from '@/infra/runtime/env.server';

import {
  assertPaymentCapabilityContract,
  resolveSitePaymentCapability,
} from '@/config/payment-capability';

function readPaymentRuntimeBindings(): PaymentRuntimeBindings {
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
          getRuntimeEnvString('STRIPE_PUBLISHABLE_KEY')?.trim() || '',
        stripeSecretKey: getRuntimeEnvString('STRIPE_SECRET_KEY')?.trim() || '',
        stripeSigningSecret:
          getRuntimeEnvString('STRIPE_SIGNING_SECRET')?.trim() || '',
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
        creemApiKey: getRuntimeEnvString('CREEM_API_KEY')?.trim() || '',
        creemSigningSecret:
          getRuntimeEnvString('CREEM_SIGNING_SECRET')?.trim() || '',
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
        paypalClientId: getRuntimeEnvString('PAYPAL_CLIENT_ID')?.trim() || '',
        paypalClientSecret:
          getRuntimeEnvString('PAYPAL_CLIENT_SECRET')?.trim() || '',
        paypalWebhookId: getRuntimeEnvString('PAYPAL_WEBHOOK_ID')?.trim() || '',
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

export function getPaymentRuntimeBindings(): PaymentRuntimeBindings {
  return { ...readPaymentRuntimeBindings() };
}
