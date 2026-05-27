// data: landing translations + build-safe public UI config + theme components
// cache: default RSC
// reason: public marketing page; keep AI navigation filtering aligned with source-controlled site capabilities
import type { Metadata } from 'next';
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
import { isPublishedLocaleForPath } from '@/infra/url/canonical';
import { site } from '@/site';
import { filterLandingButtons } from '@/surfaces/public/navigation/landing-visibility';
import {
  buildProductLandingMetadata,
  getProductLanding,
} from '@/surfaces/public/product-landing';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import type {
  Footer as FooterType,
  Header as HeaderType,
  Landing,
} from '@/shared/types/blocks/landing';
import LandingMarketingLayout from '@/themes/default/layouts/landing-marketing';
import LandingPageView from '@/themes/default/pages/landing';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isPublishedLocaleForPath('/', locale)) {
    notFound();
  }

  setRequestLocale(locale);
  const siteKey: string = site.key;
  const productLanding = getProductLanding(siteKey);
  if (!productLanding) {
    return {};
  }

  const brand = buildBrandPlaceholderValues();
  return buildProductLandingMetadata({
    landing: productLanding,
    locale,
    brand,
  });
}

export default async function LandingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isPublishedLocaleForPath('/', locale)) {
    notFound();
  }

  setRequestLocale(locale);

  const publicUiConfig = readBuildPublicUiConfig();
  const authSettings = readBuildAuthUiSettings();
  const billingSettings = readBuildBillingUiSettings();
  const brand = buildBrandPlaceholderValues();
  const siteKey: string = site.key;
  const productLanding = getProductLanding(siteKey);

  if (productLanding) {
    const { header, footer } = productLanding.buildHeaderFooter(brand);

    return (
      <LandingMarketingLayout
        header={header}
        footer={footer}
        locale={locale}
        publicUiConfig={publicUiConfig}
        authSettings={authSettings}
        billingSettings={billingSettings}
      >
        {productLanding.render()}
      </LandingMarketingLayout>
    );
  }

  // load page data
  const t = await getTranslations('landing');

  // build page params
  const hero = replaceBrandPlaceholdersDeep(t.raw('hero'), brand);
  const cta = replaceBrandPlaceholdersDeep(t.raw('cta'), brand);

  const page: Landing = {
    hero: hero
      ? {
          ...hero,
          buttons: filterLandingButtons(hero.buttons, publicUiConfig),
        }
      : undefined,
    logos: replaceBrandPlaceholdersDeep(t.raw('logos'), brand),
    introduce: replaceBrandPlaceholdersDeep(t.raw('introduce'), brand),
    benefits: replaceBrandPlaceholdersDeep(t.raw('benefits'), brand),
    usage: replaceBrandPlaceholdersDeep(t.raw('usage'), brand),
    features: replaceBrandPlaceholdersDeep(t.raw('features'), brand),
    stats: replaceBrandPlaceholdersDeep(t.raw('stats'), brand),
    subscribe: replaceBrandPlaceholdersDeep(t.raw('subscribe'), brand),
    testimonials: replaceBrandPlaceholdersDeep(t.raw('testimonials'), brand),
    faq: replaceBrandPlaceholdersDeep(t.raw('faq'), brand),
    cta: cta
      ? {
          ...cta,
          buttons: filterLandingButtons(cta.buttons, publicUiConfig),
        }
      : undefined,
  };

  // load page component
  const headerRaw: HeaderType = t.raw('header');
  const footerRaw: FooterType = t.raw('footer');
  const { header, footer } = applyBrandToLandingHeaderFooter({
    header: replaceBrandPlaceholdersDeep(headerRaw, brand),
    footer: replaceBrandPlaceholdersDeep(footerRaw, brand),
  });

  return (
    <LandingMarketingLayout
      header={header}
      footer={footer}
      locale={locale}
      publicUiConfig={publicUiConfig}
      authSettings={authSettings}
      billingSettings={billingSettings}
    >
      <LandingPageView locale={locale} page={page} />
    </LandingMarketingLayout>
  );
}
