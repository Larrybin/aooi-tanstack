import { getLocaleFromPathname } from '@/shared/i18n/locale';

export function resolveNotFoundLocale(data: unknown, pathname: string) {
  return (
    getNotFoundLocale(data) ?? getLocaleFromPathname(pathname) ?? undefined
  );
}

function getNotFoundLocale(data: unknown) {
  if (typeof data !== 'object' || data === null) {
    return undefined;
  }

  const locale = (data as { locale?: unknown }).locale;
  return typeof locale === 'string' ? locale : undefined;
}
