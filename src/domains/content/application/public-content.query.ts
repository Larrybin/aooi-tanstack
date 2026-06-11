import 'server-only';

import {
  getPosts,
  getPostsCount,
  getPost as getRemotePost,
  type Post as RemotePost,
} from '@/domains/content/application/post.query';
import {
  findTaxonomy,
  getTaxonomies,
  getTaxonomiesCount,
  type Taxonomy,
} from '@/domains/content/application/taxonomy.query';
import { formatPostDate } from '@/domains/content/domain/post-date';
import {
  PostType as DbPostType,
  PostStatus,
} from '@/domains/content/domain/post-types';
import {
  TaxonomyStatus,
  TaxonomyType,
} from '@/domains/content/domain/taxonomy-types';
import { createUseCaseLogger } from '@/infra/platform/logging/logger.server';

import type {
  Category as BlogCategoryType,
  Post as BlogPostType,
} from '@/shared/types/blocks/blog';

import {
  getDefaultBlogPageSize,
  mergeBlogPostEntries,
  paginateBlogPostEntries,
  toSortTimestamp,
  type BlogPostEntry,
} from './blog-feed';
import {
  getLocalBlogPostEntries,
  getLocalPage,
  getLocalPost,
} from './local-content';
import { getLocalPublicContentDocuments } from './public-content-manifest';

const log = createUseCaseLogger({
  domain: 'content',
  useCase: 'public-content-query',
});

export async function getDocsPage({
  slug,
  locale,
}: {
  slug: string;
  locale: string;
}): Promise<BlogPostType | null> {
  return getLocalPage({ slug, locale, pagePrefix: `/${locale}/` });
}

export async function getBlogPost({
  slug,
  locale,
  postPrefix = '/blog/',
}: {
  slug: string;
  locale: string;
  postPrefix?: string;
}): Promise<BlogPostType | null> {
  const remotePost = await getRemotePost({ slug, locale, postPrefix });
  if (remotePost) {
    return remotePost;
  }

  return getLocalPost({ slug, locale, postPrefix });
}

export async function getBlogPostsAndCategories({
  locale,
  postPrefix = '/blog/',
  categoryPrefix = '/blog/category/',
}: {
  locale: string;
  postPrefix?: string;
  categoryPrefix?: string;
}) {
  const [localEntries, remoteEntries, categories] = await Promise.all([
    getLocalBlogPostEntries({
      locale,
      postPrefix,
    }),
    getPublishedRemoteBlogPostEntries({
      locale,
      postPrefix,
    }),
    getPublishedBlogCategories({
      categoryPrefix,
    }),
  ]);

  const mergedEntries = mergeBlogPostEntries({
    localEntries,
    remoteEntries,
  });
  const posts = paginateBlogPostEntries(
    mergedEntries,
    1,
    getDefaultBlogPageSize()
  );

  return {
    posts,
    postsCount: mergedEntries.length,
    categories,
    categoriesCount: categories.length,
  };
}

export async function getBlogCategory({
  slug,
  categoryPrefix = '/blog/category/',
}: {
  slug: string;
  categoryPrefix?: string;
}): Promise<BlogCategoryType | null> {
  let category: Taxonomy | undefined;
  try {
    category = await findTaxonomy({
      slug,
      status: TaxonomyStatus.PUBLISHED,
    });
  } catch (error) {
    log.warn('blog: get category failed', {
      operation: 'get-blog-category',
      slug,
      error,
    });
    return null;
  }

  if (!category) {
    return null;
  }

  return toBlogCategory(category, categoryPrefix);
}

export async function getBlogCategoryPostsAndCategories({
  slug,
  locale,
  postPrefix = '/blog/',
  categoryPrefix = '/blog/category/',
}: {
  slug: string;
  locale: string;
  postPrefix?: string;
  categoryPrefix?: string;
}) {
  const [currentCategory, categories] = await Promise.all([
    getBlogCategory({
      slug,
      categoryPrefix,
    }),
    getPublishedBlogCategories({
      categoryPrefix,
    }),
  ]);

  if (!currentCategory?.id) {
    return null;
  }

  const remoteEntries = await getPublishedRemoteBlogPostEntries({
    locale,
    postPrefix,
    categoryId: currentCategory.id,
  });
  const posts = paginateBlogPostEntries(
    remoteEntries,
    1,
    getDefaultBlogPageSize()
  );

  return {
    currentCategory,
    categories,
    categoriesCount: categories.length,
    posts,
    postsCount: remoteEntries.length,
  };
}

export async function getPublicBlogPostStaticSlugs() {
  const [localPosts, remotePosts] = await Promise.all([
    getLocalPublicContentDocuments({ collection: 'posts' }),
    getPublishedRemoteBlogPosts(),
  ]);

  return Array.from(
    new Set([
      ...localPosts
        .map((post) => post.slug.trim())
        .filter((slug) => slug.length > 0),
      ...remotePosts
        .map((post) => post.slug?.trim() || '')
        .filter((slug) => slug.length > 0),
    ])
  ).map((slug) => ({ slug }));
}

export async function getPublicBlogCategoryStaticSlugs() {
  const categories = await getPublishedBlogCategories();

  return categories
    .map((category) => category.slug?.trim() || '')
    .filter((slug) => slug.length > 0)
    .map((slug) => ({ slug }));
}

async function getPublishedRemoteBlogPostEntries({
  locale,
  postPrefix = '/blog/',
  categoryId,
}: {
  locale: string;
  postPrefix?: string;
  categoryId?: string;
}): Promise<BlogPostEntry[]> {
  const posts = await getPublishedRemoteBlogPosts({ categoryId });

  return posts
    .map((post) => toRemoteBlogPostEntry(post, locale, postPrefix))
    .sort((entryA, entryB) => entryB.sortTimestamp - entryA.sortTimestamp);
}

async function getPublishedRemoteBlogPosts({
  categoryId,
}: {
  categoryId?: string;
} = {}) {
  try {
    const postsCount = await getPostsCount({
      type: DbPostType.ARTICLE,
      status: PostStatus.PUBLISHED,
      category: categoryId,
    });

    if (postsCount <= 0) {
      return [] satisfies RemotePost[];
    }

    return getPosts({
      type: DbPostType.ARTICLE,
      status: PostStatus.PUBLISHED,
      category: categoryId,
      page: 1,
      limit: postsCount,
    });
  } catch (error) {
    log.warn('blog: get remote posts failed', {
      operation: 'get-remote-blog-posts',
      categoryId,
      error,
    });
    return [] satisfies RemotePost[];
  }
}

async function getPublishedBlogCategories({
  categoryPrefix = '/blog/category/',
}: {
  categoryPrefix?: string;
} = {}) {
  try {
    const categoriesCount = await getTaxonomiesCount({
      type: TaxonomyType.CATEGORY,
      status: TaxonomyStatus.PUBLISHED,
    });

    if (categoriesCount <= 0) {
      return [] satisfies BlogCategoryType[];
    }

    const categories = await getTaxonomies({
      type: TaxonomyType.CATEGORY,
      status: TaxonomyStatus.PUBLISHED,
      page: 1,
      limit: categoriesCount,
    });

    return categories.map((category) =>
      toBlogCategory(category, categoryPrefix)
    );
  } catch (error) {
    log.warn('blog: get categories failed', {
      operation: 'get-blog-categories',
      error,
    });
    return [] satisfies BlogCategoryType[];
  }
}

function toRemoteBlogPostEntry(
  post: RemotePost,
  locale: string,
  postPrefix: string
): BlogPostEntry {
  const createdAtIso = post.createdAt.toISOString();

  return {
    post: {
      id: post.id,
      slug: post.slug,
      title: post.title || '',
      description: post.description || '',
      author_name: post.authorName || '',
      author_image: post.authorImage || '',
      created_at: formatPostDate(createdAtIso, locale),
      image: post.image || '',
      url: `${postPrefix}${post.slug}`,
    },
    sortTimestamp: toSortTimestamp(post.createdAt),
  };
}

function toBlogCategory(
  category: Taxonomy,
  categoryPrefix: string
): BlogCategoryType {
  return {
    id: category.id,
    slug: category.slug,
    title: category.title,
    url: `${categoryPrefix}${category.slug}`,
  };
}
