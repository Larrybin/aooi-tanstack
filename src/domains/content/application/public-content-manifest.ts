import {
  publicContentDocuments,
  type PublicContentCollection,
  type PublicContentDocument,
} from '@/public-content';

import { defaultLocale } from '@/config/locale';

export type { PublicContentCollection, PublicContentDocument };

export function getLocalPublicContentDocument({
  collection,
  slug,
  locale,
}: {
  collection: PublicContentCollection;
  slug: string;
  locale: string;
}): PublicContentDocument | null {
  const normalizedSlug = normalizeContentSlug(slug);
  return (
    findDocument({ collection, slug: normalizedSlug, locale }) ??
    findDocument({ collection, slug: normalizedSlug, locale: defaultLocale })
  );
}

export function getLocalPublicContentDocuments({
  collection,
  locale,
}: {
  collection: PublicContentCollection;
  locale?: string;
}) {
  return publicContentDocuments.filter((document) => {
    if (document.collection !== collection) return false;
    if (!locale) return true;
    return document.locale === locale;
  });
}

function findDocument({
  collection,
  slug,
  locale,
}: {
  collection: PublicContentCollection;
  slug: string;
  locale: string;
}) {
  return (
    publicContentDocuments.find(
      (document) =>
        document.collection === collection &&
        document.slug === slug &&
        document.locale === locale
    ) ?? null
  );
}

function normalizeContentSlug(value: string) {
  return value.replace(/^\/+|\/+$/g, '');
}
