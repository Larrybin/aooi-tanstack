import { getLocalPublicContentDocument } from '@/domains/content/application/public-content-manifest';
import { site } from '@/site';
import type { SlugRouteData } from '@/surfaces/landing/slug/slug.types';

import {
  buildBrandPlaceholderValues,
  replaceBrandPlaceholders,
} from '@/shared/brand/placeholders';
import { normalizeLocale } from '@/shared/i18n/locale';
import { formatPostDateForLocale } from '@/shared/lib/post-date';
import {
  buildCanonicalUrl,
  buildLanguageAlternates,
  buildSeoHead,
  isPublishedLocaleForPath,
} from '@/shared/seo/canonical';

import { resolveLandingShellData } from './landing-shell-data';

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
    shell: resolveLandingShellData(locale),
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
      createdAt: page.created_at
        ? formatPostDateForLocale(page.created_at, locale)
        : '',
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
