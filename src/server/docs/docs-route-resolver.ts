import {
  getLocalPublicContentDocument,
  getLocalPublicContentDocuments,
} from '@/domains/content/application/public-content-manifest';
import {
  buildBrandPlaceholderValues,
  replaceBrandPlaceholders,
} from '@/infra/platform/brand/placeholders.server';

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
  appName: string;
  appLogo: string;
  docsTree: SerializableDocsPageTree;
};

export type SerializableDocsPageTree = {
  name: string;
  children: SerializableDocsPageTreeItem[];
};

export type SerializableDocsPageTreeItem = {
  type: 'page';
  name: string;
  url: string;
  description?: string;
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
    appName: brand.appName,
    appLogo: brand.appLogo,
    docsTree: buildDocsPageTree(locale, brand),
  };
}

function buildDocsPageTree(
  locale: string,
  brand: ReturnType<typeof buildBrandPlaceholderValues>
): SerializableDocsPageTree {
  const documents = getLocalPublicContentDocuments({
    collection: 'docs',
    locale,
  });
  const treeDocuments =
    documents.length > 0
      ? documents
      : getLocalPublicContentDocuments({
          collection: 'docs',
          locale: defaultLocale,
        });

  return {
    name: 'Documentation',
    children: treeDocuments
      .slice()
      .sort((left, right) => sortDocsSlugs(left.slug, right.slug))
      .map((item) => ({
        type: 'page' as const,
        name: replaceBrandPlaceholders(
          item.title || item.slug || 'Documentation',
          brand
        ),
        url: localizeDocsPath(item.path, locale),
        description: item.description
          ? replaceBrandPlaceholders(item.description, brand)
          : undefined,
      })),
  };
}

function sortDocsSlugs(left: string, right: string) {
  if (left === right) return 0;
  if (!left) return -1;
  if (!right) return 1;
  return left.localeCompare(right);
}

function localizeDocsPath(path: string, locale: string) {
  if (locale === defaultLocale) return path;
  return `/${locale}${path}`;
}
