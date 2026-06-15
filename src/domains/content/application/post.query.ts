
import { formatPostDate } from '@/domains/content/domain/post-date';
import { PostStatus, type PostType } from '@/domains/content/domain/post-types';
import { generateTOC } from '@/domains/content/domain/toc';
import {
  findPostRow,
  getPostRows,
  getPostRowsCount,
} from '@/domains/content/infra/post-repo';
import { createUseCaseLogger } from '@/infra/platform/logging/logger.server';

import type { post } from '@/config/db/schema';
import type { Post as BlogPostType } from '@/shared/types/blocks/blog';

const log = createUseCaseLogger({
  domain: 'content',
  useCase: 'post-query',
});

export type Post = typeof post.$inferSelect;

export async function findPost({
  id,
  slug,
  status,
}: {
  id?: string;
  slug?: string;
  status?: PostStatus;
}) {
  return await findPostRow({ id, slug, status });
}

export async function getPosts({
  type,
  status,
  category,
  tag,
  page = 1,
  limit = 30,
}: {
  type?: PostType;
  status?: PostStatus;
  category?: string;
  tag?: string[];
  page?: number;
  limit?: number;
} = {}): Promise<Post[]> {
  return await getPostRows({ type, status, category, tag, page, limit });
}

export async function getPostsCount({
  type,
  status,
  category,
  tag,
}: {
  type?: PostType;
  status?: PostStatus;
  category?: string;
  tag?: string;
} = {}): Promise<number> {
  return await getPostRowsCount({ type, status, category, tag });
}

export async function getPost({
  slug,
  locale,
  postPrefix = '/blog/',
}: {
  slug: string;
  locale: string;
  postPrefix?: string;
}): Promise<BlogPostType | null> {
  try {
    const postData = await findPost({ slug, status: PostStatus.PUBLISHED });
    if (postData) {
      const content = postData.content || '';
      return {
        id: postData.id,
        slug: postData.slug,
        title: postData.title || '',
        description: postData.description || '',
        content,
        inlineAdContent: content,
        body: undefined,
        toc: content ? generateTOC(content) : undefined,
        created_at:
          getPostDate({
            created_at: postData.createdAt.toISOString(),
            locale,
          }) || '',
        author_name: postData.authorName || '',
        author_image: postData.authorImage || '',
        author_role: '',
        url: `${postPrefix}${postData.slug}`,
      };
    }
  } catch (e) {
    log.warn('post: get post from database failed', {
      operation: 'get-post',
      slug,
      error: e,
    });
  }

  return null;
}

function getPostDate({
  created_at,
  locale,
}: {
  created_at: string;
  locale?: string;
}) {
  return formatPostDate(created_at, locale);
}
