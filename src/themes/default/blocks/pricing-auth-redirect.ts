import { defaultLocale } from '@/config/locale';
import { withCallbackUrl } from '@/shared/lib/callback-url';
import { localizeCallbackUrl } from '@/shared/lib/localize-callback-url';

export function buildPricingSignInUrl({
  callbackUrl,
  locale,
}: {
  callbackUrl: string;
  locale: string;
}): string {
  return localizeCallbackUrl({
    callbackUrl: withCallbackUrl('/sign-in', callbackUrl),
    locale,
    defaultLocale,
  });
}
