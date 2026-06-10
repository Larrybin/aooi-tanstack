import type { Locale } from '@/config/locale';
import type { FAQ, Testimonials } from '@/shared/types/blocks/landing';
import type {
  Pricing as PricingType,
  SitePricing,
} from '@/shared/types/blocks/pricing';

type Messages = Record<string, unknown>;

const baseMessagesLocale: Locale = 'en';

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function mergeDeep(base: unknown, override: unknown): unknown {
  if (override === undefined) {
    return base;
  }

  if (isPlainObject(base) && isPlainObject(override)) {
    const merged: Record<string, unknown> = { ...base };
    for (const [key, value] of Object.entries(override)) {
      merged[key] = mergeDeep(merged[key], value);
    }
    return merged;
  }

  return override;
}

async function importPricingMessages(locale: Locale): Promise<Messages> {
  const messages = await import(
    `@/config/locale/messages/${locale}/pricing.json`
  );
  return messages.default as Messages;
}

async function importLandingMessages(locale: Locale): Promise<Messages> {
  const messages = await import(
    `@/config/locale/messages/${locale}/landing.json`
  );
  return messages.default as Messages;
}

async function loadMergedMessages(
  locale: Locale,
  loader: (locale: Locale) => Promise<Messages>
): Promise<Messages> {
  const baseMessages = await loader(baseMessagesLocale);
  if (locale === baseMessagesLocale) {
    return baseMessages;
  }

  const localizedMessages = await loader(locale);
  return mergeDeep(baseMessages, localizedMessages) as Messages;
}

export type LocalizedPricingMessages = {
  metadata?: SitePricing['metadata'];
  pricing: PricingType;
};

export type LocalizedLandingMessages = {
  faq?: FAQ;
  testimonials?: Testimonials;
};

export async function loadPricingPageMessages(locale: Locale): Promise<{
  localizedPricingMessages: LocalizedPricingMessages;
  localizedLandingMessages: LocalizedLandingMessages;
}> {
  const [pricingMessages, landingMessages] = await Promise.all([
    loadMergedMessages(locale, importPricingMessages),
    loadMergedMessages(locale, importLandingMessages),
  ]);

  return {
    localizedPricingMessages: {
      metadata: pricingMessages.metadata as SitePricing['metadata'],
      pricing: pricingMessages.pricing as PricingType,
    },
    localizedLandingMessages: {
      faq: landingMessages.faq as FAQ | undefined,
      testimonials: landingMessages.testimonials as Testimonials | undefined,
    },
  };
}
