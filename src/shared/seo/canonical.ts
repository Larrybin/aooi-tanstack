import { site, siteI18nManifest } from '@/site';

import {
  defaultLocale,
  localeHreflangs,
  locales,
  type Locale,
} from '@/config/locale';

type SiteI18nManifestLocales = Record<
  string,
  Record<string, { path: string; status: string }>
>;

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

export function getPublishedLocalesForPath(relativePath: string): Locale[] {
  const normalizedPath = normalizeRelativePath(relativePath);
  const publishedLocales = [defaultLocale];
  const manifestLocales = siteI18nManifest.locales as SiteI18nManifestLocales;

  for (const locale of locales) {
    if (locale === defaultLocale) {
      continue;
    }

    const entries = manifestLocales[locale] ?? {};
    const hasApprovedPage = Object.values(entries).some(
      (entry) => entry.path === normalizedPath && entry.status === 'approved'
    );

    if (hasApprovedPage) {
      publishedLocales.push(locale);
    }
  }

  return publishedLocales;
}

export function isPublishedLocaleForPath(relativePath: string, locale: string) {
  return getPublishedLocalesForPath(relativePath).some(
    (publishedLocale) => publishedLocale === locale
  );
}

export type TanStackHead = {
  meta?: Array<Record<string, string>>;
  links?: Array<Record<string, string>>;
};

export function buildSeoHead(input: {
  title: string;
  description: string;
  canonical: string;
  alternates?: Record<string, string>;
  locale: string;
  siteName: string;
}): TanStackHead {
  return {
    meta: [
      { title: input.title },
      { name: 'description', content: input.description },
      { property: 'og:type', content: 'website' },
      { property: 'og:locale', content: input.locale },
      { property: 'og:url', content: input.canonical },
      { property: 'og:title', content: input.title },
      { property: 'og:description', content: input.description },
      { property: 'og:site_name', content: input.siteName },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: input.title },
      { name: 'twitter:description', content: input.description },
    ],
    links: [
      { rel: 'canonical', href: input.canonical },
      ...Object.entries(input.alternates ?? {}).map(([hrefLang, href]) => ({
        rel: 'alternate',
        hrefLang,
        href,
      })),
    ],
  };
}
