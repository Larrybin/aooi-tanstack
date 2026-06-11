// data: admin session (RBAC) + posts list (db) + categories lookup (db) + pagination
// cache: no-store (request-bound auth/RBAC)
// reason: admin content management; avoid caching across users/roles
import {
  getPosts,
  getPostsCount,
  type Post,
} from '@/domains/content/application/post.query';
import { getTaxonomies } from '@/domains/content/application/taxonomy.query';
import { PostType } from '@/domains/content/domain/post-types';
import { createAdminTablePage } from '@/app/_admin-support/create-admin-table-page';
import {
  AdminPostsListQuerySchema,
  type AdminPostsListQuery,
} from '@/surfaces/admin/schemas/list';

import { PERMISSIONS } from '@/shared/constants/rbac-permissions';

export default createAdminTablePage<Post, AdminPostsListQuery>({
  namespace: 'admin.posts',
  permission: PERMISSIONS.POSTS_READ,
  crumbs: [
    { key: 'list.crumbs.admin', url: '/admin' },
    { key: 'list.crumbs.posts' },
  ],
  actions: ({ t }) => [
    {
      id: 'add',
      title: t('list.buttons.add'),
      icon: 'RiAddLine',
      url: '/admin/posts/add',
    },
  ],
  query: {
    schema: AdminPostsListQuerySchema,
    load: async ({ page, pageSize }) => {
      const [rows, total] = await Promise.all([
        getPosts({
          type: PostType.ARTICLE,
          page,
          limit: pageSize,
        }),
        getPostsCount({
          type: PostType.ARTICLE,
        }),
      ]);

      return { rows, total };
    },
  },
  columns: ({ t }) => [
    { name: 'title', title: t('fields.title') },
    { name: 'authorName', title: t('fields.author_name') },
    {
      name: 'image',
      title: t('fields.image'),
      type: 'image',
      metadata: {
        width: 100,
        height: 80,
      },
      className: 'rounded-md',
    },
    {
      name: 'categories',
      title: t('fields.categories'),
      callback: async (item) => {
        if (!item.categories) {
          return '-';
        }

        const categories = await getTaxonomies({
          ids: item.categories.split(','),
        });
        if (!categories.length) {
          return '-';
        }

        return categories.map((category) => category.title).join(', ');
      },
    },
    { name: 'createdAt', title: t('fields.created_at'), type: 'time' },
    {
      name: 'action',
      title: '',
      type: 'dropdown',
      callback: (item) => [
        {
          name: 'edit',
          title: t('list.buttons.edit'),
          icon: 'RiEditLine',
          url: `/admin/posts/${item.id}/edit`,
        },
        {
          name: 'view',
          title: t('list.buttons.view'),
          icon: 'RiEyeLine',
          url: `/blog/${item.slug}`,
          target: '_blank',
        },
      ],
    },
  ],
});
