import { defaultLocale, locales, type Locale } from '@/config/locale';

export function getRequestLocaleFallback(): Locale {
  return defaultLocale;
}

export function useLocale(): Locale {
  if (typeof globalThis.location === 'undefined') return defaultLocale;
  const firstSegment = globalThis.location.pathname.split('/').filter(Boolean)[0];
  return locales.includes(firstSegment as Locale)
    ? (firstSegment as Locale)
    : defaultLocale;
}

export function createIdentityTranslator(namespace?: string) {
  return (key: string) => (namespace ? `${namespace}.${key}` : key);
}

export function useTranslations(namespace?: string) {
  return createIdentityTranslator(namespace);
}

export async function getTranslations(namespace?: string) {
  return createIdentityTranslator(namespace);
}
