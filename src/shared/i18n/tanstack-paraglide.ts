import { m } from '@/paraglide/messages';

import { defaultLocale } from '@/config/locale';

type TanStackParaglideLocale = 'en' | 'zh' | 'zh-TW';

const tanStackParaglideLocales = new Set<string>(['en', 'zh', 'zh-TW']);

export function getTanStackNotFoundCopy(locale: string = defaultLocale) {
  const messageLocale = toTanStackParaglideLocale(locale);

  return {
    title: m.tanstack_page_not_found({}, { locale: messageLocale }),
    backHome: m.tanstack_back_home({}, { locale: messageLocale }),
  };
}

function toTanStackParaglideLocale(locale: string): TanStackParaglideLocale {
  return tanStackParaglideLocales.has(locale)
    ? (locale as TanStackParaglideLocale)
    : 'en';
}
