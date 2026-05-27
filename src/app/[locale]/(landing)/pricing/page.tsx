// data: site-scoped pricing + locale pricing copy + theme page
// cache: static (generateStaticParams) + cached public configs
// reason: marketing pricing page should stay statically prerenderable
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import {
  buildBrandPlaceholderValues,
  replaceBrandPlaceholdersDeep,
} from '@/infra/platform/brand/placeholders.server';
import { getLocaleStaticParams } from '@/infra/platform/i18n/static-params';
import {
  buildCanonicalUrl,
  buildLanguageAlternates,
  buildMetadataBaseUrl,
  getPublishedLocalesForPath,
  isPublishedLocaleForPath,
} from '@/infra/url/canonical';
import { site, sitePricing } from '@/site';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { ScopedIntlProvider } from '@/shared/lib/i18n/scoped-intl-provider';
import type { SitePricing } from '@/shared/types/blocks/pricing';
import PricingPageView from '@/themes/default/pages/pricing';

import { resolvePricingPageContent } from './pricing-content';

async function getLocalizedPricingPageMessages() {
  const [pricingMessages, landingMessages] = await Promise.all([
    getTranslations('pricing'),
    getTranslations('landing'),
  ]);

  return {
    localizedPricingMessages: {
      metadata: pricingMessages.raw('metadata') as SitePricing['metadata'],
      pricing: pricingMessages.raw('pricing') as SitePricing['pricing'],
    },
    localizedLandingMessages: {
      faq: landingMessages.raw('faq') as SitePricing['faq'],
      testimonials: landingMessages.raw(
        'testimonials'
      ) as SitePricing['testimonials'],
    },
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isPublishedLocaleForPath('/pricing', locale)) {
    notFound();
  }

  setRequestLocale(locale);

  const brand = buildBrandPlaceholderValues();
  const { localizedPricingMessages, localizedLandingMessages } =
    await getLocalizedPricingPageMessages();
  const pricingContent = sitePricing
    ? (replaceBrandPlaceholdersDeep(
        resolvePricingPageContent({
          sitePricing,
          localizedPricingMessages,
          localizedLandingMessages,
        }),
        brand
      ) as SitePricing)
    : null;

  const title = pricingContent?.metadata?.title ?? 'Pricing';
  const description =
    pricingContent?.metadata?.description ??
    `Choose a ${site.brand.appName} plan.`;

  return {
    metadataBase: buildMetadataBaseUrl(),
    title: {
      absolute: title,
    },
    description,
    alternates: {
      canonical: buildCanonicalUrl('/pricing', locale),
      languages: buildLanguageAlternates('/pricing'),
    },
    openGraph: {
      type: 'website',
      locale,
      url: buildCanonicalUrl('/pricing', locale),
      title,
      description,
      siteName: site.brand.appName,
    },
  };
}

export function generateStaticParams() {
  return getLocaleStaticParams(getPublishedLocalesForPath('/pricing'));
}

export default async function PricingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isPublishedLocaleForPath('/pricing', locale)) {
    notFound();
  }

  setRequestLocale(locale);

  if (!sitePricing) {
    notFound();
  }

  const brand = buildBrandPlaceholderValues();
  const { localizedPricingMessages, localizedLandingMessages } =
    await getLocalizedPricingPageMessages();
  const pricingContent = replaceBrandPlaceholdersDeep(
    resolvePricingPageContent({
      sitePricing,
      localizedPricingMessages,
      localizedLandingMessages,
    }),
    brand
  ) as SitePricing;

  return (
    <ScopedIntlProvider
      locale={locale}
      namespaces={['pricing.page', 'common.payment']}
    >
      <PricingPageView
        locale={locale}
        pricing={pricingContent.pricing}
        faq={pricingContent.faq}
        testimonials={pricingContent.testimonials}
      />
    </ScopedIntlProvider>
  );
}
