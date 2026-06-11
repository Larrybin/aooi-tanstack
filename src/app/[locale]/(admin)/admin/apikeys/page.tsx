// data: admin session (RBAC) + api keys list (db) + pagination
// cache: no-store (request-bound auth/RBAC)
// reason: api keys are sensitive; avoid caching across users/roles
import {
  listAdminApikeysQuery,
  type AdminApikeyRow,
} from '@/domains/account/application/admin-apikeys.query';
import { createAdminTablePage } from '@/app/_admin-support/create-admin-table-page';
import {
  AdminApikeysListQuerySchema,
  type AdminApikeysListQuery,
} from '@/surfaces/admin/schemas/list';

import { PERMISSIONS } from '@/shared/constants/rbac-permissions';

export default createAdminTablePage<AdminApikeyRow, AdminApikeysListQuery>({
  namespace: 'admin.apikeys',
  permission: PERMISSIONS.APIKEYS_READ,
  crumbs: [
    { key: 'list.crumbs.admin', url: '/admin' },
    { key: 'list.crumbs.apikeys' },
  ],
  query: {
    schema: AdminApikeysListQuerySchema,
    load: async ({ page, pageSize }) =>
      listAdminApikeysQuery({
        page,
        limit: pageSize,
      }),
  },
  columns: ({ t }) => [
    { name: 'title', title: t('fields.title') },
    { name: 'key', title: t('fields.key'), type: 'copy' },
    { name: 'user', title: t('fields.user'), type: 'user' },
    { name: 'status', title: t('fields.status'), type: 'label' },
    { name: 'createdAt', title: t('fields.created_at'), type: 'time' },
  ],
});
