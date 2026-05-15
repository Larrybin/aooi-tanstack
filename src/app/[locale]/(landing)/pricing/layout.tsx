// data: landing translations (header/footer) + theme layout
// cache: default (no explicit fetch)
// reason: shared landing shell; keep data loading in leaf pages
import type { ReactNode } from 'react';
import { buildRemoverHeaderFooter } from '@/domains/remover/ui/remover-shell';
import {
  readAuthUiRuntimeSettingsCached,
  readBillingRuntimeSettingsCached,
  readPublicUiConfigCached,
} from '@/domains/settings/application/settings-runtime.query';
import { applyBrandToLandingHeaderFooter } from '@/infra/platform/brand/identity';
import {
  buildBrandPlaceholderValues,
  replaceBrandPlaceholdersDeep,
} from '@/infra/platform/brand/placeholders.server';
import { site } from '@/site';
import { getTranslations } from 'next-intl/server';

import { LocaleDetectorLazy } from '@/shared/blocks/common/locale-detector-lazy';
import { PublicAppProvider } from '@/shared/contexts/app';
import { ScopedIntlProvider } from '@/shared/lib/i18n/scoped-intl-provider';
import type {
  Footer as FooterType,
  Header as HeaderType,
} from '@/shared/types/blocks/landing';
import LandingLayout from '@/themes/default/layouts/landing';
import LandingMarketingLayout from '@/themes/default/layouts/landing-marketing';

export default async function PricingLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const [publicUiConfig, authSettings, billingSettings] = await Promise.all([
    readPublicUiConfigCached(),
    readAuthUiRuntimeSettingsCached(),
    readBillingRuntimeSettingsCached(),
  ]);
  const brand = buildBrandPlaceholderValues();
  const siteKey: string = site.key;

  if (siteKey === 'ai-remover') {
    const { header, footer } = buildRemoverHeaderFooter(brand);

    return (
      <LandingMarketingLayout
        header={header}
        footer={footer}
        locale={locale}
        publicUiConfig={publicUiConfig}
        authSettings={authSettings}
        billingSettings={billingSettings}
      >
        {children}
      </LandingMarketingLayout>
    );
  }

  const t = await getTranslations('landing');
  const header: HeaderType = t.raw('header');
  const footer: FooterType = t.raw('footer');
  const branded = applyBrandToLandingHeaderFooter({
    header: replaceBrandPlaceholdersDeep(header, brand),
    footer: replaceBrandPlaceholdersDeep(footer, brand),
  });

  return (
    <ScopedIntlProvider
      locale={locale}
      namespaces={[
        'common.sign',
        'common.locale_switcher',
        'common.locale_detector',
      ]}
    >
      <PublicAppProvider
        initialUiConfig={publicUiConfig}
        initialAuthSettings={authSettings}
        initialBillingSettings={billingSettings}
      >
        <LandingLayout
          header={branded.header}
          footer={branded.footer}
          publicConfig={publicUiConfig}
        >
          <LocaleDetectorLazy />
          {children}
        </LandingLayout>
      </PublicAppProvider>
    </ScopedIntlProvider>
  );
}
