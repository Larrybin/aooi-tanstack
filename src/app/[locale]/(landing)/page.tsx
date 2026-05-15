// data: landing translations + public configs (unstable_cache tag=public-configs, revalidate=3600s) + theme components
// cache: cached configs + default RSC
// reason: public marketing page; allow toggles without per-request db reads
import type { Metadata } from 'next';
import { RemoverHome } from '@/domains/remover/ui/remover-home';
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
import {
  buildCanonicalUrl,
  buildLanguageAlternates,
  buildMetadataBaseUrl,
} from '@/infra/url/canonical';
import { site } from '@/site';
import { filterLandingButtons } from '@/surfaces/public/navigation/landing-visibility';
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
  setRequestLocale(locale);
  const siteKey: string = site.key;

  if (siteKey !== 'ai-remover') {
    return {};
  }

  const brand = buildBrandPlaceholderValues();
  const title = 'AI Remover - Remove Objects from Photos for Free';
  const description =
    'Remove unwanted objects, people, and distractions from photos in seconds with AI Remover.';
  const canonicalUrl = buildCanonicalUrl('/', locale);
  const imageUrl = brand.appOgImage.startsWith('http')
    ? brand.appOgImage
    : `${brand.appUrl}${brand.appOgImage}`;

  return {
    metadataBase: buildMetadataBaseUrl(),
    title: {
      absolute: title,
    },
    description,
    keywords: [
      'ai remover',
      'ai object remover',
      'remove objects from photos',
      'remove unwanted objects from photos',
      'remove people from photos',
    ],
    alternates: {
      canonical: canonicalUrl,
      languages: buildLanguageAlternates('/'),
    },
    openGraph: {
      type: 'website',
      locale,
      url: canonicalUrl,
      title,
      description,
      siteName: brand.appName,
      images: [imageUrl],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [imageUrl],
      site: brand.appUrl,
    },
  };
}

export default async function LandingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

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
        <RemoverHome />
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
