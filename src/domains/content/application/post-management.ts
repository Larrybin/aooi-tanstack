
import { PostStatus } from '@/domains/content/domain/post-types';
import { addPostRow, updatePostRow } from '@/domains/content/infra/post-repo';

import type { post } from '@/config/db/schema';

export type NewPost = typeof post.$inferInsert;
export type UpdatePost = Partial<Omit<NewPost, 'id' | 'createdAt'>>;

export async function addPost(data: NewPost) {
  return await addPostRow(data);
}

export async function updatePost(id: string, data: UpdatePost) {
  return await updatePostRow(id, data);
}

export async function deletePost(id: string) {
  const result = await updatePost(id, {
    status: PostStatus.ARCHIVED,
  });

  return result;
}
