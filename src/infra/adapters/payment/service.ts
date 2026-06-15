
import type {
  CheckoutSession,
  PaymentEvent,
  PaymentOrder,
  PaymentProvider,
  PaymentSession,
} from '@/domains/billing/domain/payment';
import { parseStripePaymentMethodsConfig } from '@/domains/billing/domain/payment-config';
import type {
  BillingRuntimeSettings,
  PaymentRuntimeBindings,
} from '@/domains/settings/application/settings-runtime.contracts';
import { createUseCaseLogger } from '@/infra/platform/logging/logger.server';

import { ServiceUnavailableError } from '@/shared/lib/api/errors';
import { isProductionEnv } from '@/shared/lib/env';

const log = createUseCaseLogger({
  domain: 'billing',
  useCase: 'payment-adapter-service',
});

type PaymentServiceInput = {
  settings: BillingRuntimeSettings;
  bindings: PaymentRuntimeBindings;
};

function assertStructuredPaymentInput(
  input: unknown
): asserts input is PaymentServiceInput {
  if (
    typeof input !== 'object' ||
    input === null ||
    !('settings' in input) ||
    !('bindings' in input) ||
    Object.keys(input as Record<string, unknown>).some(
      (key) => key !== 'settings' && key !== 'bindings'
    )
  ) {
    throw new Error('Payment service requires structured settings + bindings');
  }
}

async function addStripeProvider(
  input: PaymentServiceInput
): Promise<PaymentProvider> {
  const { StripeProvider } = await import('@/infra/adapters/payment/stripe');
  const { settings, bindings } = input;
  if (settings.provider !== 'stripe' || bindings.provider !== 'stripe') {
    throw new ServiceUnavailableError(
      'payment bindings/provider mismatch for stripe'
    );
  }
  const isProduction = isProductionEnv();

  if (isProduction && !bindings.stripeSigningSecret.trim()) {
    throw new ServiceUnavailableError(
      'stripe_signing_secret is required in production'
    );
  }

  let allowedPaymentMethods = ['card'];
  const stripePaymentMethodsConfig = settings.stripePaymentMethods;

  if (stripePaymentMethodsConfig) {
    const result = parseStripePaymentMethodsConfig(stripePaymentMethodsConfig);
    if (!result.ok) {
      log.warn(
        'payment: invalid stripe payment methods config, fallback to card',
        {
          operation: 'parse-stripe-payment-methods',
          error: result.error,
        }
      );
    } else {
      allowedPaymentMethods = result.methods;
    }
  }

  return new StripeProvider({
    secretKey: bindings.stripeSecretKey,
    publishableKey: bindings.stripePublishableKey,
    signingSecret: bindings.stripeSigningSecret,
    allowedPaymentMethods,
  });
}

async function addCreemProvider(
  input: PaymentServiceInput
): Promise<PaymentProvider> {
  const { CreemProvider } = await import('@/infra/adapters/payment/creem');
  const { settings, bindings } = input;
  if (settings.provider !== 'creem' || bindings.provider !== 'creem') {
    throw new ServiceUnavailableError(
      'payment bindings/provider mismatch for creem'
    );
  }

  return new CreemProvider({
    apiKey: bindings.creemApiKey,
    environment: settings.creemEnvironment,
    signingSecret: bindings.creemSigningSecret,
  });
}

async function addPayPalProvider(
  input: PaymentServiceInput
): Promise<PaymentProvider> {
  const { PayPalProvider } = await import('@/infra/adapters/payment/paypal');
  const { settings, bindings } = input;
  if (settings.provider !== 'paypal' || bindings.provider !== 'paypal') {
    throw new ServiceUnavailableError(
      'payment bindings/provider mismatch for paypal'
    );
  }

  return new PayPalProvider({
    clientId: bindings.paypalClientId,
    clientSecret: bindings.paypalClientSecret,
    webhookId: bindings.paypalWebhookId,
    environment: settings.paypalEnvironment,
  });
}

export type PaymentService = {
  getProvider(name: string): PaymentProvider | undefined;
  getDefaultProvider(): PaymentProvider;
  createPayment(input: { order: PaymentOrder }): Promise<CheckoutSession>;
  getPaymentSession(input: { sessionId: string }): Promise<PaymentSession>;
  getPaymentEvent(input: { req: Request }): Promise<PaymentEvent>;
};

export async function getPaymentService(
  input: PaymentServiceInput
): Promise<PaymentService> {
  assertStructuredPaymentInput(input);
  const provider = await (async (): Promise<PaymentProvider> => {
    switch (input.settings.provider) {
      case 'stripe':
        return await addStripeProvider(input);
      case 'creem':
        return await addCreemProvider(input);
      case 'paypal':
        return await addPayPalProvider(input);
      case 'none':
        throw new ServiceUnavailableError('No payment provider configured');
    }
  })();

  return {
    getProvider: (name) => (provider.name === name ? provider : undefined),
    getDefaultProvider: () => provider,
    async createPayment(nextInput) {
      return await provider.createPayment({
        order: nextInput.order,
      });
    },
    async getPaymentSession(nextInput) {
      return await provider.getPaymentSession({
        sessionId: nextInput.sessionId,
      });
    },
    async getPaymentEvent(nextInput) {
      return await provider.getPaymentEvent({
        req: nextInput.req,
      });
    },
  } satisfies PaymentService;
}
