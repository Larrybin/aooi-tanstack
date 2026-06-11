import { getLocalPublicContentDocument } from '@/domains/content/application/public-content-manifest';
import { site } from '@/site';
import type { SlugRouteData } from '@/surfaces/landing/slug/slug.types';

import {
  buildBrandPlaceholderValues,
  replaceBrandPlaceholders,
} from '@/shared/brand/placeholders';
import { normalizeLocale } from '@/shared/i18n/locale';
import {
  buildCanonicalUrl,
  buildLanguageAlternates,
  buildSeoHead,
  isPublishedLocaleForPath,
} from '@/shared/seo/canonical';

export async function resolveSlugRouteData({
  locale: localeInput,
  slug: slugInput,
}: {
  locale: unknown;
  slug: unknown;
}): Promise<SlugRouteData | null> {
  const locale = normalizeLocale(
    typeof localeInput === 'string' ? localeInput : null
  );
  const slug = normalizeSlug(slugInput);
  if (!locale || !slug) {
    return null;
  }

  const canonicalPath = `/${slug}`;
  if (!isPublishedLocaleForPath(canonicalPath, locale)) {
    return null;
  }

  const page = getLocalPublicContentDocument({
    collection: 'pages',
    slug,
    locale,
  });
  if (!page) {
    return null;
  }

  const brand = buildBrandPlaceholderValues();
  const title = replaceBrandPlaceholders(page.title || slug, brand);
  const description = replaceBrandPlaceholders(
    page.description || `${title} from ${site.brand.appName}`,
    brand
  );
  const content = replaceBrandPlaceholders(page.content, brand);
  const canonical = buildCanonicalUrl(canonicalPath, locale);

  return {
    locale,
    slug,
    canonicalPath,
    head: buildSeoHead({
      title: `${title} | ${site.brand.appName}`,
      description,
      canonical,
      alternates: buildLanguageAlternates(canonicalPath),
      locale,
      siteName: site.brand.appName,
    }),
    page: {
      id: page.sourcePath,
      slug,
      title,
      description,
      content,
      createdAt: formatSlugPageDate(page.created_at, locale),
      toc: page.toc,
    },
  };
}

function normalizeSlug(value: unknown) {
  if (typeof value !== 'string') {
    return null;
  }

  const slug = value.trim().replace(/^\/+|\/+$/g, '');
  return slug && !slug.includes('/') ? slug : null;
}

function formatSlugPageDate(createdAt: string, locale: string) {
  if (!createdAt) {
    return '';
  }

  const date = new Date(`${createdAt}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    return createdAt;
  }

  if (locale === 'zh') {
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${date.getUTCFullYear()}/${month}/${day}`;
  }

  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}
