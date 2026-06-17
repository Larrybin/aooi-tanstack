import { getLocalPublicContentDocument } from '@/domains/content/application/public-content-manifest';

import { defaultLocale } from '@/config/locale';
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
  const locale = normalizeLocale(input.locale) ?? defaultLocale;
  const slug = normalizeDocsSlug(input.slug);
  const document = getLocalPublicContentDocument({
    collection: 'docs',
    slug: slug.join('/'),
    locale,
  });
  if (!document) return null;

  return {
    title: document.title || 'Documentation',
    description: document.description || '',
    content: document.content,
    slug,
    locale,
  };
}
