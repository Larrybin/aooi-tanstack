// data: admin session (RBAC) + categories list (db) + pagination
// cache: no-store (request-bound auth/RBAC)
// reason: admin-managed taxonomy; avoid caching across users/roles
import {
  getTaxonomies,
  getTaxonomiesCount,
  type Taxonomy,
} from '@/domains/content/application/taxonomy.query';
import { TaxonomyType } from '@/domains/content/domain/taxonomy-types';
import { createAdminTablePage } from '@/app/_admin-support/create-admin-table-page';
import {
  AdminCategoriesListQuerySchema,
  type AdminCategoriesListQuery,
} from '@/surfaces/admin/schemas/list';

import { PERMISSIONS } from '@/shared/constants/rbac-permissions';

export default createAdminTablePage<Taxonomy, AdminCategoriesListQuery>({
  namespace: 'admin.categories',
  permission: PERMISSIONS.CATEGORIES_READ,
  crumbs: [
    { key: 'list.crumbs.admin', url: '/admin' },
    { key: 'list.crumbs.categories' },
  ],
  actions: ({ t }) => [
    {
      id: 'add',
      title: t('list.buttons.add'),
      icon: 'RiAddLine',
      url: '/admin/categories/add',
    },
  ],
  query: {
    schema: AdminCategoriesListQuerySchema,
    load: async ({ page, pageSize }) => {
      const [rows, total] = await Promise.all([
        getTaxonomies({
          type: TaxonomyType.CATEGORY,
          page,
          limit: pageSize,
        }),
        getTaxonomiesCount({
          type: TaxonomyType.CATEGORY,
        }),
      ]);

      return { rows, total };
    },
  },
  columns: ({ t }) => [
    {
      name: 'slug',
      title: t('fields.slug'),
      type: 'copy',
      metadata: { message: 'Copied' },
    },
    { name: 'title', title: t('fields.title') },
    {
      name: 'status',
      title: t('fields.status'),
      type: 'label',
      metadata: { variant: 'outline' },
    },
    { name: 'createdAt', title: t('fields.created_at'), type: 'time' },
    { name: 'updatedAt', title: t('fields.updated_at'), type: 'time' },
    {
      name: 'action',
      title: '',
      type: 'dropdown',
      callback: (item) => [
        {
          id: 'edit',
          title: t('list.buttons.edit'),
          icon: 'RiEditLine',
          url: `/admin/categories/${item.id}/edit`,
        },
      ],
    },
  ],
});
