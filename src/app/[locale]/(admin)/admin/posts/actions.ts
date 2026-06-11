'use server';

import {
  addPost,
  updatePost,
  type NewPost,
} from '@/domains/content/application/post-management';
import { findPost } from '@/domains/content/application/post.query';
import { PostStatus, PostType } from '@/domains/content/domain/post-types';
import { AdminPostFormSchema } from '@/surfaces/admin/schemas/post';
import { validateAndParseForm } from '@/app/_admin-support/action-utils';

import { PERMISSIONS } from '@/shared/constants/rbac-permissions';
import { ActionError } from '@/shared/lib/action/errors';
import { actionOk } from '@/shared/lib/action/result';
import { withAction } from '@/shared/lib/action/with-action';
import { getUuid } from '@/shared/lib/hash';

/**
 * Create a new post
 */
export async function createPostAction(formData: FormData) {
  return withAction(async () => {
    const { user, data } = await validateAndParseForm({
      formData,
      permission: PERMISSIONS.POSTS_WRITE,
      schema: AdminPostFormSchema,
      errorMessage: 'slug and title are required',
    });

    const newPost: NewPost = {
      id: getUuid(),
      userId: user.id,
      parentId: '',
      slug: data.slug.toLowerCase(),
      type: PostType.ARTICLE,
      title: data.title,
      description: data.description ?? '',
      image: data.image ?? '',
      content: data.content ?? '',
      categories: data.categories ?? '',
      tags: '',
      authorName: data.authorName ?? '',
      authorImage: data.authorImage ?? '',
      status: PostStatus.PUBLISHED,
    };

    const result = await addPost(newPost);
    if (!result) {
      throw new ActionError('add post failed');
    }

    return actionOk('post added', '/admin/posts');
  });
}

/**
 * Update an existing post
 */
export async function updatePostAction(id: string, formData: FormData) {
  return withAction(async () => {
    const { data } = await validateAndParseForm({
      formData,
      permission: PERMISSIONS.POSTS_WRITE,
      schema: AdminPostFormSchema,
      errorMessage: 'slug and title are required',
    });

    const post = await findPost({ id });
    if (!post) {
      throw new ActionError('Post not found');
    }

    const result = await updatePost(id, {
      parentId: '',
      slug: data.slug.toLowerCase(),
      type: PostType.ARTICLE,
      title: data.title,
      description: data.description ?? '',
      image: data.image ?? '',
      content: data.content ?? '',
      categories: data.categories ?? '',
      tags: '',
      authorName: data.authorName ?? '',
      authorImage: data.authorImage ?? '',
      status: PostStatus.PUBLISHED,
    });

    if (!result) {
      throw new ActionError('update post failed');
    }

    return actionOk('post updated', '/admin/posts');
  });
}
