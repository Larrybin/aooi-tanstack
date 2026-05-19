// data: build-safe public UI config + landing translations + theme layout
// cache: default RSC
// reason: public blog uses source-controlled site capabilities for blog and AI navigation visibility
import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
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
import { getSite } from '@/infra/platform/site';
import { getTranslations } from 'next-intl/server';

import { LocaleDetector } from '@/shared/blocks/common/locale-detector';
import { PublicAppProvider } from '@/shared/contexts/app';
import { ScopedIntlProvider } from '@/shared/lib/i18n/scoped-intl-provider';
import type {
  Footer as FooterType,
  Header as HeaderType,
} from '@/shared/types/blocks/landing';
import LandingLayout from '@/themes/default/layouts/landing';

export default async function BlogLayout({
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
  if (!getSite().capabilities.blog) {
    notFound();
  }

  const t = await getTranslations('landing');
  const brand = buildBrandPlaceholderValues();

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
        'blog.page',
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
          <LocaleDetector />
          {children}
        </LandingLayout>
      </PublicAppProvider>
    </ScopedIntlProvider>
  );
}
