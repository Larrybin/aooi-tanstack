import type {
  LocalizedLandingMessages,
  LocalizedPricingMessages,
} from '@/domains/pricing/application/pricing-page-content';
import { getScopedMessages } from '@/infra/platform/i18n/messages';

import type { Locale } from '@/config/locale';

export async function loadPricingPageMessages(locale: Locale): Promise<{
  localizedPricingMessages: LocalizedPricingMessages;
  localizedLandingMessages: LocalizedLandingMessages;
}> {
  const messages = await getScopedMessages(locale, ['pricing', 'landing']);
  const pricingMessages = messages.pricing as LocalizedPricingMessages;
  const landingMessages = messages.landing as LocalizedLandingMessages;

  return {
    localizedPricingMessages: pricingMessages,
    localizedLandingMessages: landingMessages,
  };
}
