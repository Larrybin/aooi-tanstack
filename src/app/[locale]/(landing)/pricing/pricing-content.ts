import type {
  FAQ as FAQType,
  Testimonials as TestimonialsType,
} from '@/shared/types/blocks/landing';
import type {
  Pricing as PricingType,
  SitePricing,
} from '@/shared/types/blocks/pricing';

type LocalizedPricingMessages = {
  metadata?: SitePricing['metadata'];
  pricing: PricingType;
};

type LocalizedLandingMessages = {
  faq?: FAQType;
  testimonials?: TestimonialsType;
};

function getPricingProductIds(pricing: PricingType) {
  return pricing.items?.map((item) => item.product_id) ?? [];
}

export function canUseLocalizedPricingMessages({
  sitePricing,
  localizedPricing,
}: {
  sitePricing: SitePricing;
  localizedPricing: PricingType;
}) {
  const siteProductIds = getPricingProductIds(sitePricing.pricing);
  const localizedProductIds = getPricingProductIds(localizedPricing);

  return (
    siteProductIds.length > 0 &&
    siteProductIds.length === localizedProductIds.length &&
    siteProductIds.every(
      (productId, index) => productId === localizedProductIds[index]
    )
  );
}

export function resolvePricingPageContent({
  sitePricing,
  siteLocalePricing,
  localizedPricingMessages,
  localizedLandingMessages,
}: {
  sitePricing: SitePricing;
  siteLocalePricing?: SitePricing;
  localizedPricingMessages: LocalizedPricingMessages;
  localizedLandingMessages: LocalizedLandingMessages;
}): SitePricing {
  if (
    siteLocalePricing &&
    canUseLocalizedPricingMessages({
      sitePricing,
      localizedPricing: siteLocalePricing.pricing,
    })
  ) {
    return siteLocalePricing;
  }

  if (
    !canUseLocalizedPricingMessages({
      sitePricing,
      localizedPricing: localizedPricingMessages.pricing,
    })
  ) {
    return sitePricing;
  }

  return {
    ...sitePricing,
    metadata: localizedPricingMessages.metadata ?? sitePricing.metadata,
    pricing: localizedPricingMessages.pricing,
    faq: localizedLandingMessages.faq ?? sitePricing.faq,
    testimonials:
      localizedLandingMessages.testimonials ?? sitePricing.testimonials,
  };
}
