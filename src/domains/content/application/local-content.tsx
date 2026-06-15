
import { formatPostDate } from '@/domains/content/domain/post-date';
import { generateTOC } from '@/domains/content/domain/toc';

import { defaultLocale } from '@/config/locale';
import {
  buildBrandPlaceholderValues,
  replaceBrandPlaceholders,
} from '@/shared/brand/placeholders';
import type { Post as BlogPostType } from '@/shared/types/blocks/blog';

import { toSortTimestamp, type BlogPostEntry } from './blog-feed';
import {
  getLocalPublicContentDocument,
  getLocalPublicContentDocuments,
} from './public-content-manifest';

export async function getLocalPost({
  slug,
  locale,
  postPrefix = '/blog/',
}: {
  slug: string;
  locale: string;
  postPrefix?: string;
}): Promise<BlogPostType | null> {
  const localPost = getLocalPublicContentDocument({
    collection: 'posts',
    slug,
    locale,
  });
  if (!localPost) {
    return null;
  }

  const brand = buildBrandPlaceholderValues();
  const content = replaceBrandPlaceholders(localPost.content, brand);

  return {
    id: localPost.sourcePath,
    slug,
    title: replaceBrandPlaceholders(localPost.title, brand),
    description: replaceBrandPlaceholders(localPost.description, brand),
    content,
    inlineAdContent: content,
    toc: localPost.toc,
    created_at: localPost.created_at
      ? formatPostDate(localPost.created_at, locale)
      : '',
    author_name: localPost.author_name,
    author_image: localPost.author_image,
    author_role: '',
    url: `${postPrefix}${slug}`,
  };
}

export async function getLocalPage({
  slug,
  locale,
  pagePrefix = '/',
}: {
  slug: string;
  locale: string;
  pagePrefix?: string;
}): Promise<BlogPostType | null> {
  const localPage = getLocalPublicContentDocument({
    collection: 'pages',
    slug,
    locale,
  });
  if (!localPage) {
    return null;
  }

  const brand = buildBrandPlaceholderValues();
  const content = replaceBrandPlaceholders(localPage.content, brand);

  return {
    id: localPage.sourcePath,
    slug,
    title: replaceBrandPlaceholders(localPage.title, brand),
    description: replaceBrandPlaceholders(localPage.description, brand),
    content,
    toc: localPage.toc,
    created_at: localPage.created_at
      ? formatPostDate(localPage.created_at, locale)
      : '',
    author_name: '',
    author_image: '',
    author_role: '',
    url: `${pagePrefix}${slug}`,
  };
}

export async function getLocalBlogPostEntries({
  locale,
  postPrefix = '/blog/',
}: {
  locale: string;
  postPrefix?: string;
}) {
  const requestedLocale = locale;
  let localPosts = getLocalPublicContentDocuments({
    collection: 'posts',
    locale,
  });

  if (localPosts.length === 0 && locale !== defaultLocale) {
    localPosts = getLocalPublicContentDocuments({
      collection: 'posts',
      locale: defaultLocale,
    });
  }

  if (!localPosts || localPosts.length === 0) {
    return [] satisfies BlogPostEntry[];
  }

  const brand = buildBrandPlaceholderValues();

  return localPosts.map((post) => {
    const rawCreatedAt = post.created_at;

    return {
      post: {
        id: post.sourcePath,
        slug: post.slug,
        title: replaceBrandPlaceholders(post.title, brand),
        description: replaceBrandPlaceholders(post.description, brand),
        author_name: post.author_name,
        author_image: post.author_image,
        created_at: rawCreatedAt
          ? formatPostDate(rawCreatedAt, requestedLocale)
          : '',
        image: post.image,
        url: `${postPrefix}${post.slug}`,
      } satisfies BlogPostType,
      sortTimestamp: toSortTimestamp(rawCreatedAt),
    } satisfies BlogPostEntry;
  });
}

export function buildPostTocFromMarkdown(content: string) {
  return generateTOC(content);
}
