// data: landing translations (header/footer) + theme layout + build-safe AI availability
// cache: default RSC
// reason: share the landing shell for AI demo pages; gate access via source-controlled site capabilities
import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { isAiEnabled } from '@/domains/ai/domain/enablement';
import {
  readBuildAuthUiSettings,
  readBuildBillingUiSettings,
  readBuildPublicUiConfig,
} from '@/domains/settings/application/settings-build.query';
import { applyBrandToLandingHeaderFooter } from '@/infra/platform/brand/identity';
import {
  buildBrandPlaceholderValues,
  replaceBrandPlaceholdersDeep,
} from '@/infra/platform/brand/placeholders.server';
import { getTranslations } from 'next-intl/server';

import { LocaleDetector } from '@/shared/blocks/common/locale-detector';
import { PublicAppProvider } from '@/shared/contexts/app';
import { ScopedIntlProvider } from '@/shared/lib/i18n/scoped-intl-provider';
import type {
  Footer as FooterType,
  Header as HeaderType,
} from '@/shared/types/blocks/landing';
import LandingLayout from '@/themes/default/layouts/landing';

export default async function AiLandingLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const publicUiConfig = readBuildPublicUiConfig();
  const authSettings = readBuildAuthUiSettings();
  const billingSettings = readBuildBillingUiSettings();
  if (!isAiEnabled(publicUiConfig)) {
    notFound();
  }

  const t = await getTranslations('landing');
  const brand = buildBrandPlaceholderValues();

  const headerRaw: HeaderType = t.raw('header');
  const footerRaw: FooterType = t.raw('footer');
  const { header, footer } = applyBrandToLandingHeaderFooter({
    header: replaceBrandPlaceholdersDeep(headerRaw, brand),
    footer: replaceBrandPlaceholdersDeep(footerRaw, brand),
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
          header={header}
          footer={footer}
          publicConfig={publicUiConfig}
        >
          <LocaleDetector />
          {children}
        </LandingLayout>
      </PublicAppProvider>
    </ScopedIntlProvider>
  );
}
