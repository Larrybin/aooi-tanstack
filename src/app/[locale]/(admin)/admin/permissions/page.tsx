// data: admin session (RBAC) + permissions list (db)
// cache: no-store (request-bound auth/RBAC)
// reason: permission catalog is admin-only; avoid caching across users/roles
import { accessControlRuntimeDeps } from '@/app/access-control/runtime-deps';
import {
  listAdminPermissionsQuery,
  type AdminPermissionRow,
} from '@/domains/access-control/application/admin-roles.query';
import { createAdminTablePage } from '@/app/_admin-support/create-admin-table-page';
import {
  AdminPermissionsListQuerySchema,
  type AdminPermissionsListQuery,
} from '@/surfaces/admin/schemas/list';

import { PERMISSIONS } from '@/shared/constants/rbac-permissions';

export default createAdminTablePage<
  AdminPermissionRow,
  AdminPermissionsListQuery
>({
  namespace: 'admin.permissions',
  permission: PERMISSIONS.PERMISSIONS_READ,
  crumbs: [
    { key: 'list.crumbs.admin', url: '/admin' },
    { key: 'list.crumbs.permissions' },
  ],
  query: {
    schema: AdminPermissionsListQuerySchema,
    load: async () => listAdminPermissionsQuery(accessControlRuntimeDeps),
  },
  columns: ({ t }) => [
    { name: 'code', title: t('fields.code') },
    { name: 'title', title: t('fields.title') },
    { name: 'resource', title: t('fields.resource') },
    { name: 'action', title: t('fields.action') },
    { name: 'createdAt', title: t('fields.created_at'), type: 'time' },
  ],
});
