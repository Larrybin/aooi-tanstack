import {
  createContext,
  createElement,
  useContext,
  type ReactNode,
} from 'react';

import { defaultLocale, locales, type Locale } from '@/config/locale';

import { createNativeTranslator } from './native';

const NativeLocaleContext = createContext<Locale | null>(null);

export function NativeLocaleProvider({
  children,
  locale,
}: {
  children: ReactNode;
  locale: Locale;
}) {
  return createElement(
    NativeLocaleContext.Provider,
    { value: locale },
    children
  );
}

export function useLocale(): Locale {
  const contextLocale = useContext(NativeLocaleContext);
  if (contextLocale) return contextLocale;
  if (typeof globalThis.location === 'undefined') return defaultLocale;
  const firstSegment = globalThis.location.pathname
    .split('/')
    .filter(Boolean)[0];
  return locales.includes(firstSegment as Locale)
    ? (firstSegment as Locale)
    : defaultLocale;
}

export function useTranslations(namespace?: string) {
  return createNativeTranslator(namespace, useLocale());
}
