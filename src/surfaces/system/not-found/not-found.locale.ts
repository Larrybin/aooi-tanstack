const tanStackNotFoundPathLocales = new Set(['en', 'zh', 'zh-TW']);

export function resolveNotFoundLocale(data: unknown, pathname: string) {
  return getNotFoundLocale(data) ?? getLocaleFromPathname(pathname);
}

function getNotFoundLocale(data: unknown) {
  if (typeof data !== 'object' || data === null) {
    return undefined;
  }

  const locale = (data as { locale?: unknown }).locale;
  return typeof locale === 'string' ? locale : undefined;
}

function getLocaleFromPathname(pathname: string) {
  const [firstSegment] = pathname.split('/').filter(Boolean);
  return firstSegment && tanStackNotFoundPathLocales.has(firstSegment)
    ? firstSegment
    : undefined;
}
