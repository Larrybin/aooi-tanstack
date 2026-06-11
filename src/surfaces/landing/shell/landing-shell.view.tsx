import type { ReactNode } from 'react';
import { site, sitePricing } from '@/site';

import { defaultLocale } from '@/config/locale';
import { LocaleDetector } from '@/shared/blocks/common/locale-detector';
import { PublicAppProvider } from '@/shared/contexts/app';

type PaymentCapability = 'none' | 'stripe' | 'creem' | 'paypal';

function localizePath(path: string, locale: string) {
  if (locale === defaultLocale) {
    return path;
  }

  return path === '/' ? `/${locale}` : `/${locale}${path}`;
}

function buildBillingSettings(payment: PaymentCapability) {
  const shared = {
    locale: '',
    defaultLocale,
  } as const;

  switch (payment) {
    case 'stripe':
      return {
        ...shared,
        provider: 'stripe' as const,
        paymentCapability: 'stripe' as const,
        stripePaymentMethods: '',
      };
    case 'creem':
      return {
        ...shared,
        provider: 'creem' as const,
        paymentCapability: 'creem' as const,
        creemEnvironment: 'sandbox' as const,
        creemProductIds: '',
      };
    case 'paypal':
      return {
        ...shared,
        provider: 'paypal' as const,
        paymentCapability: 'paypal' as const,
        paypalEnvironment: 'sandbox' as const,
      };
    case 'none':
      return {
        ...shared,
        provider: 'none' as const,
        paymentCapability: 'none' as const,
      };
  }
}

const publicUiConfig = {
  aiEnabled: Boolean(site.capabilities.ai),
  localeSwitcherEnabled: false,
  socialLinksEnabled: false,
  socialLinksJson: '',
  socialLinks: [],
  affiliate: {
    affonsoEnabled: false,
    promotekitEnabled: false,
  },
};

const authSettings = {
  emailAuthEnabled: false,
  googleAuthEnabled: false,
  googleOneTapEnabled: false,
  googleClientId: '',
  githubAuthEnabled: false,
};

export function LandingShellView({
  children,
  locale,
}: {
  children: ReactNode;
  locale: string;
}) {
  const homeHref = localizePath('/', locale);
  const pricingHref = localizePath('/pricing', locale);
  const privacyHref = localizePath('/privacy-policy', locale);
  const termsHref = localizePath('/terms-of-service', locale);
  const billingSettings = buildBillingSettings(site.capabilities.payment);

  return (
    <PublicAppProvider
      initialUiConfig={publicUiConfig}
      initialAuthSettings={authSettings}
      initialBillingSettings={billingSettings}
    >
      <LocaleDetector />
      <div className="landing-shell">
        <header className="landing-shell-header">
          <a className="landing-shell-brand" href={homeHref}>
            {site.brand.logo ? (
              <img src={site.brand.logo} alt="" aria-hidden="true" />
            ) : null}
            <span>{site.brand.appName}</span>
          </a>
          <nav className="landing-shell-nav" aria-label="Primary navigation">
            <a href={homeHref}>Home</a>
            {sitePricing ? <a href={pricingHref}>Pricing</a> : null}
          </nav>
        </header>

        <main className="landing-shell-main">{children}</main>

        <footer className="landing-shell-footer">
          <span>© {site.brand.appName}</span>
          <nav aria-label="Legal navigation">
            <a href={privacyHref}>Privacy Policy</a>
            <a href={termsHref}>Terms of Service</a>
          </nav>
        </footer>
      </div>
    </PublicAppProvider>
  );
}
