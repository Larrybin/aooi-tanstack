import type { ReactNode } from 'react';
import type {
  AuthUiRuntimeSettings,
  BillingRuntimeSettings,
  PublicUiConfig,
} from '@/domains/settings/application/settings-runtime.contracts';

import { PublicAppProvider } from '@/shared/contexts/app';
import { ScopedIntlProvider } from '@/shared/lib/i18n/scoped-intl-provider';
import type {
  Footer as FooterType,
  Header as HeaderType,
} from '@/shared/types/blocks/landing';

import { MarketingFooter } from '../blocks/marketing-footer';
import { MarketingHeader } from '../blocks/marketing-header';

export default async function LandingMarketingLayout({
  children,
  header,
  footer,
  locale,
  publicUiConfig,
  authSettings,
  billingSettings,
}: {
  children: ReactNode;
  header: HeaderType;
  footer: FooterType;
  locale: string;
  publicUiConfig: PublicUiConfig;
  authSettings: AuthUiRuntimeSettings;
  billingSettings: BillingRuntimeSettings;
}) {
  return (
    <ScopedIntlProvider
      locale={locale}
      namespaces={['common.sign', 'common.locale_switcher']}
    >
      <PublicAppProvider
        initialUiConfig={publicUiConfig}
        initialAuthSettings={authSettings}
        initialBillingSettings={billingSettings}
      >
        <div className="min-h-screen w-full">
          <MarketingHeader
            header={header}
            locale={locale}
            publicConfig={publicUiConfig}
          />
          <main role="main">{children}</main>
          <MarketingFooter
            footer={footer}
            locale={locale}
            publicConfig={publicUiConfig}
          />
        </div>
      </PublicAppProvider>
    </ScopedIntlProvider>
  );
}
