import 'server-only';

import { site, siteI18nManifest } from '@/site';

import { defaultLocale, localeHreflangs, locales } from '@/config/locale';

function stripTrailingSlash(value: string) {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

function normalizeRelativePath(value: string) {
  if (!value) return '/';
  if (value.startsWith('/')) return value;
  return `/${value}`;
}

export function buildCanonicalUrl(pathOrUrl: string, locale?: string) {
  if (!pathOrUrl) {
    pathOrUrl = '/';
  }

  if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
    return pathOrUrl;
  }

  const baseUrl = stripTrailingSlash(site.brand.appUrl);
  const relativePath = normalizeRelativePath(pathOrUrl);
  const localePrefix = !locale || locale === defaultLocale ? '' : `/${locale}`;

  if (relativePath === '/') {
    return localePrefix ? `${baseUrl}${localePrefix}` : `${baseUrl}/`;
  }

  return `${baseUrl}${localePrefix}${relativePath}`;
}

export function buildMetadataBaseUrl() {
  return new URL(site.brand.appUrl);
}

export function buildLanguageAlternates(relativePath: string) {
  if (
    relativePath.startsWith('http://') ||
    relativePath.startsWith('https://')
  ) {
    return undefined;
  }

  const publishedLocales = getPublishedLocalesForPath(relativePath);

  return Object.fromEntries([
    ...publishedLocales.map((locale) => [
      localeHreflangs[locale],
      buildCanonicalUrl(relativePath, locale),
    ]),
    ['x-default', buildCanonicalUrl(relativePath, defaultLocale)],
  ]);
}

export function getPublishedLocalesForPath(relativePath: string) {
  const normalizedPath = normalizeRelativePath(relativePath);
  const publishedLocales = [defaultLocale];

  for (const locale of locales) {
    if (locale === defaultLocale) {
      continue;
    }

    const entries = siteI18nManifest.locales[locale] ?? {};
    const hasApprovedPage = Object.values(entries).some(
      (entry) => entry.path === normalizedPath && entry.status === 'approved'
    );

    if (hasApprovedPage) {
      publishedLocales.push(locale);
    }
  }

  return publishedLocales;
}
