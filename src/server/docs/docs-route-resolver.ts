import { getLocalPublicContentDocument } from '@/domains/content/application/public-content-manifest';
import {
  buildBrandPlaceholderValues,
  replaceBrandPlaceholders,
} from '@/infra/platform/brand/placeholders.server';

import { normalizeLocale } from '@/shared/i18n/locale';

export type DocsRouteInput = {
  locale: string;
  slug?: string[];
};

export type DocsRouteData = {
  title: string;
  description: string;
  content: string;
  slug: string[];
  locale: string;
};

export function normalizeDocsSlug(slug: unknown): string[] {
  if (!Array.isArray(slug)) return [];
  return slug
    .filter((segment): segment is string => typeof segment === 'string')
    .map((segment) => segment.trim())
    .filter(Boolean);
}

export function resolveDocsRouteData(
  input: DocsRouteInput
): DocsRouteData | null {
  const locale = normalizeLocale(input.locale);
  if (!locale) return null;
  const slug = normalizeDocsSlug(input.slug);
  const document = getLocalPublicContentDocument({
    collection: 'docs',
    slug: slug.join('/'),
    locale,
  });
  if (!document) return null;

  const brand = buildBrandPlaceholderValues();

  return {
    title: replaceBrandPlaceholders(document.title || 'Documentation', brand),
    description: replaceBrandPlaceholders(document.description || '', brand),
    content: replaceBrandPlaceholders(document.content, brand),
    slug,
    locale,
  };
}
