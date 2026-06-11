// data: admin session (RBAC) + roles list (db) + includeDeleted flag (query)
// cache: no-store (request-bound auth/RBAC)
// reason: role management is permission-gated; avoid caching across admins
import { accessControlRuntimeDeps } from '@/app/access-control/runtime-deps';
import {
  listAdminRolesQuery,
  type AdminRoleRow,
} from '@/domains/access-control/application/admin-roles.query';
import { createAdminTablePage } from '@/app/_admin-support/create-admin-table-page';
import {
  AdminRolesListQuerySchema,
  type AdminRolesListQuery,
} from '@/surfaces/admin/schemas/list';

import { PERMISSIONS } from '@/shared/constants/rbac-permissions';

export default createAdminTablePage<AdminRoleRow, AdminRolesListQuery>({
  namespace: 'admin.roles',
  permission: PERMISSIONS.ROLES_READ,
  crumbs: [
    { key: 'list.crumbs.admin', url: '/admin' },
    { key: 'list.crumbs.roles' },
  ],
  actions: ({ t, query }) => [
    query.includeDeleted
      ? {
          title: t('list.buttons.hide_deleted'),
          url: '/admin/roles',
          variant: 'outline',
        }
      : {
          title: t('list.buttons.show_deleted'),
          url: '/admin/roles?includeDeleted=true',
          variant: 'outline',
        },
  ],
  query: {
    schema: AdminRolesListQuerySchema,
    load: async ({ includeDeleted }) =>
      listAdminRolesQuery({ includeDeleted }, accessControlRuntimeDeps),
  },
  columns: ({ t, query }) => [
    { name: 'name', title: t('fields.name') },
    { name: 'title', title: t('fields.title') },
    { name: 'description', title: t('fields.description'), type: 'copy' },
    { name: 'status', title: t('fields.status'), type: 'label' },
    { name: 'createdAt', title: t('fields.created_at'), type: 'time' },
    ...(query.includeDeleted
      ? [
          {
            name: 'deletedAt',
            title: t('fields.deleted_at'),
            type: 'time' as const,
          },
        ]
      : []),
    {
      name: 'actions',
      title: t('fields.actions'),
      type: 'dropdown',
      callback: (item) => {
        if (item.deletedAt) {
          if (!query.includeDeleted) {
            return [];
          }

          return [
            {
              name: 'restore',
              title: t('list.buttons.restore'),
              icon: 'RiRefreshLine',
              url: `/admin/roles/${item.id}/restore`,
            },
          ];
        }

        return [
          {
            name: 'edit',
            title: t('list.buttons.edit'),
            icon: 'RiEditLine',
            url: `/admin/roles/${item.id}/edit`,
          },
          {
            name: 'edit_permissions',
            title: t('list.buttons.edit_permissions'),
            icon: 'RiEditLine',
            url: `/admin/roles/${item.id}/edit-permissions`,
          },
          {
            name: 'delete',
            title: t('list.buttons.delete'),
            icon: 'RiDeleteBinLine',
            url: `/admin/roles/${item.id}/delete`,
          },
        ];
      },
    },
  ],
});
