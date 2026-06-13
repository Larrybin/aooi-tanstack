import { defaultLocale, locales, type Locale } from '@/config/locale';

export function normalizeLocale(
  value: string | undefined | null
): Locale | null {
  if (!value) return null;
  return locales.includes(value as Locale) ? (value as Locale) : null;
}

export function getLocaleFromPathname(pathname: string): Locale | null {
  const [pathWithoutSearch] = pathname.split('?');
  const [pathWithoutHash] = (pathWithoutSearch ?? '').split('#');
  const [firstSegment] = pathWithoutHash.split('/').filter(Boolean);

  return normalizeLocale(firstSegment ?? null);
}

export function localePath(path: string, locale: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  if (locale === defaultLocale) return normalizedPath;
  return `/${locale}${normalizedPath}`;
}
