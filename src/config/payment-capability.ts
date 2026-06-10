import { site } from '@/site';

import {
  NotFoundError,
  ServiceUnavailableError,
} from '@/shared/lib/api/errors';

export const PAYMENT_CAPABILITIES = [
  'none',
  'stripe',
  'creem',
  'paypal',
] as const;

export type PaymentCapability = (typeof PAYMENT_CAPABILITIES)[number];
export type ActivePaymentCapability = Exclude<PaymentCapability, 'none'>;

export type PaymentCapabilityContractReason =
  | 'capability_disabled'
  | 'resource_not_found'
  | 'provider_mismatch'
  | 'missing_provider_secret'
  | 'misconfigured_provider';

export type PaymentContractEnvSnapshot = {
  stripePublishableKey?: string;
  stripeSecretKey?: string;
  stripeSigningSecret?: string;
  creemApiKey?: string;
  creemSigningSecret?: string;
  paypalClientId?: string;
  paypalClientSecret?: string;
  paypalWebhookId?: string;
};

export type PaymentContractSettingsSnapshot = {
  stripePaymentMethods?: string;
  creemEnvironment?: 'sandbox' | 'production';
  creemProductIds?: string;
  paypalEnvironment?: 'sandbox' | 'production';
};

export type PaymentContractInput = {
  capability: PaymentCapability;
  settings: PaymentContractSettingsSnapshot;
  bindings: PaymentContractEnvSnapshot;
};

export type PaymentHealth =
  | {
      capability: 'none';
      status: 'disabled';
      provider: null;
      missing: [];
    }
  | {
      capability: ActivePaymentCapability;
      status: 'ok' | 'misconfigured';
      provider: ActivePaymentCapability;
      missing: string[];
    };

function isPaymentCapability(value: unknown): value is PaymentCapability {
  return (
    typeof value === 'string' &&
    PAYMENT_CAPABILITIES.includes(value as PaymentCapability)
  );
}

function normalizeRequiredSecret(
  value: string | undefined | null
): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function resolveRequiredSecretNames(
  capability: ActivePaymentCapability
): readonly string[] {
  switch (capability) {
    case 'stripe':
      return [
        'STRIPE_PUBLISHABLE_KEY',
        'STRIPE_SECRET_KEY',
        'STRIPE_SIGNING_SECRET',
      ] as const;
    case 'creem':
      return ['CREEM_API_KEY', 'CREEM_SIGNING_SECRET'] as const;
    case 'paypal':
      return [
        'PAYPAL_CLIENT_ID',
        'PAYPAL_CLIENT_SECRET',
        'PAYPAL_WEBHOOK_ID',
      ] as const;
  }
}

function collectMissingSecrets(
  capability: ActivePaymentCapability,
  bindings: PaymentContractEnvSnapshot
): string[] {
  const collectMissing = (
    entries: ReadonlyArray<readonly [string, string | undefined]>
  ) =>
    entries.reduce<string[]>((missing, [name, value]) => {
      if (!normalizeRequiredSecret(value)) {
        missing.push(name);
      }
      return missing;
    }, []);

  switch (capability) {
    case 'stripe':
      return collectMissing([
        ['STRIPE_PUBLISHABLE_KEY', bindings.stripePublishableKey],
        ['STRIPE_SECRET_KEY', bindings.stripeSecretKey],
        ['STRIPE_SIGNING_SECRET', bindings.stripeSigningSecret],
      ]);
    case 'creem':
      return collectMissing([
        ['CREEM_API_KEY', bindings.creemApiKey],
        ['CREEM_SIGNING_SECRET', bindings.creemSigningSecret],
      ]);
    case 'paypal':
      return collectMissing([
        ['PAYPAL_CLIENT_ID', bindings.paypalClientId],
        ['PAYPAL_CLIENT_SECRET', bindings.paypalClientSecret],
        ['PAYPAL_WEBHOOK_ID', bindings.paypalWebhookId],
      ]);
  }
}

export function resolveSitePaymentCapability(): PaymentCapability {
  const capability = site.capabilities.payment;
  if (!isPaymentCapability(capability)) {
    throw new Error(
      `Unsupported site payment capability: ${String(capability)}`
    );
  }

  return capability;
}

export function assertPaymentCapabilityContract(input: PaymentContractInput): {
  capability: PaymentCapability;
  activeProvider: ActivePaymentCapability | null;
  requiredSecrets: readonly string[];
} {
  if (!isPaymentCapability(input.capability)) {
    throw new Error(
      `Unsupported payment capability contract: ${String(input.capability)}`
    );
  }

  if (input.capability === 'none') {
    return {
      capability: input.capability,
      activeProvider: null,
      requiredSecrets: [],
    };
  }

  const missing = collectMissingSecrets(input.capability, input.bindings);
  if (missing.length > 0) {
    throw new ServiceUnavailableError(
      `payment capability contract is missing required secrets for ${input.capability}`,
      {
        capability: input.capability,
        missing,
      },
      {
        internalMeta: {
          reason: 'missing_provider_secret',
          capability: input.capability,
          missing,
        },
      }
    );
  }

  return {
    capability: input.capability,
    activeProvider: input.capability,
    requiredSecrets: resolveRequiredSecretNames(input.capability),
  };
}

export function resolvePaymentHealth(
  input: PaymentContractInput
): PaymentHealth {
  if (input.capability === 'none') {
    return {
      capability: 'none',
      status: 'disabled',
      provider: null,
      missing: [],
    };
  }

  const missing = collectMissingSecrets(input.capability, input.bindings);
  return {
    capability: input.capability,
    status: missing.length === 0 ? 'ok' : 'misconfigured',
    provider: input.capability,
    missing,
  };
}

export function throwPaymentCapabilityNotFound(
  reason: PaymentCapabilityContractReason = 'capability_disabled'
): never {
  throw new NotFoundError('not found', undefined, {
    internalMeta: { reason },
  });
}

export function assertPaymentCapabilityEnabled(
  capability: PaymentCapability = resolveSitePaymentCapability()
): ActivePaymentCapability {
  if (capability === 'none') {
    throwPaymentCapabilityNotFound('capability_disabled');
  }

  return capability;
}

export function assertPaymentProviderMatchesSite(
  provider: string,
  capability: ActivePaymentCapability = assertPaymentCapabilityEnabled()
): ActivePaymentCapability {
  if (provider.trim() !== capability) {
    throwPaymentCapabilityNotFound('provider_mismatch');
  }

  return capability;
}
