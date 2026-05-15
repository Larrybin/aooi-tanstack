import {
  ADS_RUNTIME_SETTING_KEYS,
  AFFILIATE_RUNTIME_SETTING_KEYS,
  AI_RUNTIME_SETTING_KEYS,
  ANALYTICS_RUNTIME_SETTING_KEYS,
  AUTH_RUNTIME_SETTING_KEYS,
  BILLING_RUNTIME_SETTING_KEYS,
  CUSTOMER_SERVICE_RUNTIME_SETTING_KEYS,
  EMAIL_RUNTIME_SETTING_KEYS,
  PUBLIC_UI_SETTING_KEYS,
} from '@/domains/settings/registry';
import { site } from '@/site';

import type { PaymentCapability } from '@/config/payment-capability';
import { parseGeneralSocialLinks } from '@/shared/lib/general-ui.client';

import type {
  AdsRuntimeSettings,
  AffiliateRuntimeSettings,
  AiRuntimeSettings,
  AnalyticsRuntimeSettings,
  AuthServerBindings,
  AuthUiRuntimeSettings,
  BillingRuntimeSettings,
  CustomerServiceRuntimeSettings,
  EmailRuntimeSettings,
  PublicUiConfig,
} from './settings-runtime.contracts';
import type { Configs } from './settings-store';

function isEnabled(value: string | undefined, fallback = false): boolean {
  if (value === undefined) {
    return fallback;
  }
  return value === 'true';
}

function readString(value: string | undefined): string {
  return value ?? '';
}

function readPositiveInteger(
  value: string | undefined,
  fallback: number
): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function buildPublicUiConfig(configs: Configs): PublicUiConfig {
  const socialLinksJson = readString(
    configs[PUBLIC_UI_SETTING_KEYS.socialLinks]
  );

  return {
    aiEnabled: isEnabled(configs[PUBLIC_UI_SETTING_KEYS.aiEnabled]),
    localeSwitcherEnabled: isEnabled(
      configs[PUBLIC_UI_SETTING_KEYS.localeSwitcherEnabled]
    ),
    socialLinksEnabled: isEnabled(
      configs[PUBLIC_UI_SETTING_KEYS.socialLinksEnabled]
    ),
    socialLinksJson,
    socialLinks: parseGeneralSocialLinks(socialLinksJson),
    affiliate: {
      affonsoEnabled: isEnabled(configs[PUBLIC_UI_SETTING_KEYS.affonsoEnabled]),
      promotekitEnabled: isEnabled(
        configs[PUBLIC_UI_SETTING_KEYS.promotekitEnabled]
      ),
    },
  };
}

export function buildAuthUiRuntimeSettings(
  configs: Configs,
  bindings: AuthServerBindings
): AuthUiRuntimeSettings {
  const googleRequested = isEnabled(
    configs[AUTH_RUNTIME_SETTING_KEYS.googleAuthEnabled]
  );
  const githubRequested = isEnabled(
    configs[AUTH_RUNTIME_SETTING_KEYS.githubAuthEnabled]
  );
  const googleClientIdPresent = bindings.googleClientId.trim().length > 0;
  const googleAuthEnabled = googleRequested;
  const githubAuthEnabled = githubRequested;
  const googleOneTapEnabled =
    googleAuthEnabled &&
    googleClientIdPresent &&
    isEnabled(configs[AUTH_RUNTIME_SETTING_KEYS.googleOneTapEnabled]);
  const googleClientId = googleOneTapEnabled
    ? readString(bindings.googleClientId)
    : '';

  return {
    emailAuthEnabled:
      isEnabled(configs[AUTH_RUNTIME_SETTING_KEYS.emailAuthEnabled], true) ||
      (!googleAuthEnabled && !githubAuthEnabled),
    googleAuthEnabled,
    googleOneTapEnabled,
    googleClientId,
    githubAuthEnabled,
  };
}

export function buildEmailRuntimeSettings(
  configs: Configs
): EmailRuntimeSettings {
  return {
    resendSenderEmail: readString(
      configs[EMAIL_RUNTIME_SETTING_KEYS.resendSenderEmail]
    ).trim(),
  };
}

export function buildBillingRuntimeSettings(
  configs: Configs
): BillingRuntimeSettings {
  const shared = {
    locale: readString(configs[BILLING_RUNTIME_SETTING_KEYS.locale]),
    defaultLocale: readString(
      configs[BILLING_RUNTIME_SETTING_KEYS.defaultLocale]
    ),
  } as const;
  const paymentCapability = site.capabilities.payment as PaymentCapability;

  switch (paymentCapability) {
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
        stripePaymentMethods: readString(
          configs[BILLING_RUNTIME_SETTING_KEYS.stripePaymentMethods]
        ),
      };
    case 'creem':
      return {
        ...shared,
        provider: 'creem',
        paymentCapability: 'creem',
        creemEnvironment:
          configs[BILLING_RUNTIME_SETTING_KEYS.creemEnvironment] ===
          'production'
            ? 'production'
            : 'sandbox',
        creemProductIds: readString(
          configs[BILLING_RUNTIME_SETTING_KEYS.creemProductIds]
        ),
      };
    case 'paypal':
      return {
        ...shared,
        provider: 'paypal',
        paymentCapability: 'paypal',
        paypalEnvironment:
          configs[BILLING_RUNTIME_SETTING_KEYS.paypalEnvironment] ===
          'production'
            ? 'production'
            : 'sandbox',
      };
  }
}

export function buildAiRuntimeSettings(configs: Configs): AiRuntimeSettings {
  return {
    aiEnabled: isEnabled(configs[AI_RUNTIME_SETTING_KEYS.aiEnabled]),
  };
}

export function buildAnalyticsRuntimeSettings(
  configs: Configs
): AnalyticsRuntimeSettings {
  return {
    googleAnalyticsId: readString(
      configs[ANALYTICS_RUNTIME_SETTING_KEYS.googleAnalyticsId]
    ).trim(),
    clarityId: readString(
      configs[ANALYTICS_RUNTIME_SETTING_KEYS.clarityId]
    ).trim(),
    plausibleDomain: readString(
      configs[ANALYTICS_RUNTIME_SETTING_KEYS.plausibleDomain]
    ).trim(),
    plausibleSrc: readString(
      configs[ANALYTICS_RUNTIME_SETTING_KEYS.plausibleSrc]
    ).trim(),
    openpanelClientId: readString(
      configs[ANALYTICS_RUNTIME_SETTING_KEYS.openpanelClientId]
    ).trim(),
  };
}

export function buildAffiliateRuntimeSettings(
  configs: Configs
): AffiliateRuntimeSettings {
  return {
    affonsoEnabled: isEnabled(
      configs[AFFILIATE_RUNTIME_SETTING_KEYS.affonsoEnabled]
    ),
    affonsoId: readString(
      configs[AFFILIATE_RUNTIME_SETTING_KEYS.affonsoId]
    ).trim(),
    affonsoCookieDuration: readPositiveInteger(
      configs[AFFILIATE_RUNTIME_SETTING_KEYS.affonsoCookieDuration],
      30
    ),
    promotekitEnabled: isEnabled(
      configs[AFFILIATE_RUNTIME_SETTING_KEYS.promotekitEnabled]
    ),
    promotekitId: readString(
      configs[AFFILIATE_RUNTIME_SETTING_KEYS.promotekitId]
    ).trim(),
  };
}

export function buildCustomerServiceRuntimeSettings(
  configs: Configs
): CustomerServiceRuntimeSettings {
  return {
    crispEnabled: isEnabled(
      configs[CUSTOMER_SERVICE_RUNTIME_SETTING_KEYS.crispEnabled]
    ),
    crispWebsiteId: readString(
      configs[CUSTOMER_SERVICE_RUNTIME_SETTING_KEYS.crispWebsiteId]
    ).trim(),
    tawkEnabled: isEnabled(
      configs[CUSTOMER_SERVICE_RUNTIME_SETTING_KEYS.tawkEnabled]
    ),
    tawkPropertyId: readString(
      configs[CUSTOMER_SERVICE_RUNTIME_SETTING_KEYS.tawkPropertyId]
    ).trim(),
    tawkWidgetId: readString(
      configs[CUSTOMER_SERVICE_RUNTIME_SETTING_KEYS.tawkWidgetId]
    ).trim(),
  };
}

export function buildAdsRuntimeSettings(configs: Configs): AdsRuntimeSettings {
  const adsProvider = readString(
    configs[ADS_RUNTIME_SETTING_KEYS.adsProvider]
  ).trim();
  return {
    adsEnabled: isEnabled(configs[ADS_RUNTIME_SETTING_KEYS.adsEnabled]),
    adsProvider:
      adsProvider === 'adsense' || adsProvider === 'adsterra'
        ? adsProvider
        : '',
    adsenseClientId: readString(
      configs[ADS_RUNTIME_SETTING_KEYS.adsenseClientId]
    ).trim(),
    adsenseSlotLandingInlinePrimary: readString(
      configs[ADS_RUNTIME_SETTING_KEYS.adsenseSlotLandingInlinePrimary]
    ).trim(),
    adsenseSlotBlogPostInline: readString(
      configs[ADS_RUNTIME_SETTING_KEYS.adsenseSlotBlogPostInline]
    ).trim(),
    adsenseSlotBlogPostFooter: readString(
      configs[ADS_RUNTIME_SETTING_KEYS.adsenseSlotBlogPostFooter]
    ).trim(),
    adsterraMode: readString(
      configs[ADS_RUNTIME_SETTING_KEYS.adsterraMode]
    ).trim(),
    adsterraGlobalSnippet: readString(
      configs[ADS_RUNTIME_SETTING_KEYS.adsterraGlobalSnippet]
    ).trim(),
    adsterraZoneLandingInlinePrimarySnippet: readString(
      configs[ADS_RUNTIME_SETTING_KEYS.adsterraZoneLandingInlinePrimarySnippet]
    ).trim(),
    adsterraZoneBlogPostInlineSnippet: readString(
      configs[ADS_RUNTIME_SETTING_KEYS.adsterraZoneBlogPostInlineSnippet]
    ).trim(),
    adsterraZoneBlogPostFooterSnippet: readString(
      configs[ADS_RUNTIME_SETTING_KEYS.adsterraZoneBlogPostFooterSnippet]
    ).trim(),
    adsterraAdsTxtEntry: readString(
      configs[ADS_RUNTIME_SETTING_KEYS.adsterraAdsTxtEntry]
    ).trim(),
  };
}
