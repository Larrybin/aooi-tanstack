import { site, sitePricing } from '@/site';

import type { SiteCapabilities } from '@/config/site-capabilities';
import type { SitePricing } from '@/shared/types/blocks/pricing';

import type {
  AuthUiRuntimeSettings,
  BillingRuntimeSettings,
  PublicUiConfig,
} from './settings-runtime.contracts';

type BuildSiteInput = {
  capabilities: SiteCapabilities;
};

const BUILD_DEFAULT_LOCALE = 'en';
const BUILD_SOCIAL_LINKS_JSON = '';

function clone<T>(value: T): T {
  return structuredClone(value);
}

export function buildPublicUiConfigFromSite(
  siteConfig: BuildSiteInput
): PublicUiConfig {
  return {
    aiEnabled: siteConfig.capabilities.enabledModules.includes('ai'),
    localeSwitcherEnabled: false,
    socialLinksEnabled: false,
    socialLinksJson: BUILD_SOCIAL_LINKS_JSON,
    socialLinks: [],
    affiliate: {
      affonsoEnabled: false,
      promotekitEnabled: false,
    },
  };
}

export function buildAuthUiSettingsFromSite(
  _siteConfig: BuildSiteInput
): AuthUiRuntimeSettings {
  return {
    emailAuthEnabled: false,
    googleAuthEnabled: false,
    googleOneTapEnabled: false,
    googleClientId: '',
    githubAuthEnabled: false,
  };
}

export function buildBillingUiSettingsFromSite(
  siteConfig: BuildSiteInput
): BillingRuntimeSettings {
  const shared = {
    locale: '',
    defaultLocale: BUILD_DEFAULT_LOCALE,
  } as const;

  switch (siteConfig.capabilities.paymentProvider) {
    case 'none':
      return {
        ...shared,
        provider: 'none',
        paymentCapability: 'none',
      };
    case 'stripe':
      return {
        ...shared,
        provider: 'stripe',
        paymentCapability: 'stripe',
        stripePaymentMethods: '',
      };
    case 'creem':
      return {
        ...shared,
        provider: 'creem',
        paymentCapability: 'creem',
        creemEnvironment: 'sandbox',
        creemProductIds: '',
      };
    case 'paypal':
      return {
        ...shared,
        provider: 'paypal',
        paymentCapability: 'paypal',
        paypalEnvironment: 'sandbox',
      };
  }
}

export function readBuildPublicUiConfig(): PublicUiConfig {
  return clone(buildPublicUiConfigFromSite(site));
}

export function readBuildAuthUiSettings(): AuthUiRuntimeSettings {
  return clone(buildAuthUiSettingsFromSite(site));
}

export function readBuildBillingUiSettings(): BillingRuntimeSettings {
  return clone(buildBillingUiSettingsFromSite(site));
}

export function readBuildPricingDisplayConfig(): SitePricing | undefined {
  return clone(sitePricing);
}
