import { site, siteLocalizedPricing, sitePricing } from '@/site';

import {
  buildBrandPlaceholderValues,
  replaceBrandPlaceholdersDeep,
} from '@/shared/brand/placeholders';
import { normalizeLocale } from '@/shared/i18n/locale';
import {
  buildCanonicalUrl,
  buildLanguageAlternates,
  buildSeoHead,
  isPublishedLocaleForPath,
  type TanStackHead,
} from '@/shared/seo/canonical';
import type { SitePricing } from '@/shared/types/blocks/pricing';

import { resolvePricingPageContent } from './pricing-page-content';
import { loadPricingPageMessages } from './pricing-page-messages';

type SiteLocalizedPricing = Record<string, SitePricing>;

function getSiteLocalePricing(locale: string): SitePricing | undefined {
  return (siteLocalizedPricing as SiteLocalizedPricing)[locale];
}

export type PricingRouteData = {
  locale: string;
  head: TanStackHead;
  pricing: SitePricing['pricing'];
  faq?: SitePricing['faq'];
  testimonials?: SitePricing['testimonials'];
};

export async function resolvePricingRouteData({
  locale: localeInput,
}: {
  locale: string;
}): Promise<PricingRouteData | null> {
  const locale = normalizeLocale(localeInput);
  if (!locale) {
    return null;
  }

  if (!isPublishedLocaleForPath('/pricing', locale)) {
    return null;
  }

  if (!sitePricing) {
    return null;
  }

  const brand = buildBrandPlaceholderValues();
  const { localizedPricingMessages, localizedLandingMessages } =
    await loadPricingPageMessages(locale);
  const pricingContent = replaceBrandPlaceholdersDeep(
    resolvePricingPageContent({
      sitePricing,
      siteLocalePricing: getSiteLocalePricing(locale),
      localizedPricingMessages,
      localizedLandingMessages,
    }),
    brand
  ) as SitePricing;

  const title = pricingContent.metadata?.title ?? 'Pricing';
  const description =
    pricingContent.metadata?.description ??
    `Choose a ${site.brand.appName} plan.`;
  const canonical = buildCanonicalUrl('/pricing', locale);

  return {
    locale,
    head: buildSeoHead({
      title,
      description,
      canonical,
      alternates: buildLanguageAlternates('/pricing'),
      locale,
      siteName: site.brand.appName,
    }),
    pricing: pricingContent.pricing,
    faq: pricingContent.faq,
    testimonials: pricingContent.testimonials,
  };
}
