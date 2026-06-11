// data: admin session (RBAC) + users list (db) + roles/credits (db) + pagination/search
// cache: no-store (request-bound auth/RBAC)
// reason: admin data is user/role-specific; avoid caching across users
import { accessControlRuntimeDeps } from '@/app/access-control/runtime-deps';
import { accountRuntimeDeps } from '@/app/account/runtime-deps';
import { listAdminUsersQuery } from '@/domains/account/application/admin-users.query';
import type { AccountAdminUserRecord } from '@/domains/account/application/use-cases';
import { createAdminTablePage } from '@/app/_admin-support/create-admin-table-page';
import {
  AdminUsersListQuerySchema,
  type AdminUsersListQuery,
} from '@/surfaces/admin/schemas/list';

import { Badge } from '@/shared/components/ui/badge';
import { PERMISSIONS } from '@/shared/constants/rbac-permissions';

export default createAdminTablePage<
  AccountAdminUserRecord,
  AdminUsersListQuery
>({
  namespace: 'admin.users',
  permission: PERMISSIONS.USERS_READ,
  crumbs: [
    { key: 'list.crumbs.admin', url: '/admin' },
    { key: 'list.crumbs.users' },
  ],
  search: {
    name: 'email',
    titleKey: 'list.search.email.title',
    placeholderKey: 'list.search.email.placeholder',
  },
  query: {
    schema: AdminUsersListQuerySchema,
    load: async ({ page, pageSize, email }) => {
      return listAdminUsersQuery(
        {
          email,
          page,
          limit: pageSize,
        },
        {
          getUsers: accountRuntimeDeps.getUsers,
          getUsersCount: accountRuntimeDeps.getUsersCount,
          getRemainingCredits: accountRuntimeDeps.getRemainingCredits,
          listUserRolesDetailed: accessControlRuntimeDeps.listUserRolesDetailed,
        }
      );
    },
  },
  columns: ({ t }) => [
    { name: 'id', title: t('fields.id'), type: 'copy' },
    { name: 'name', title: t('fields.name') },
    {
      name: 'image',
      title: t('fields.avatar'),
      type: 'image',
      placeholder: '-',
    },
    { name: 'email', title: t('fields.email'), type: 'copy' },
    {
      name: 'roles',
      title: t('fields.roles'),
      callback: (item) => {
        const roles = item.roles ?? [];
        return (
          <div className="flex flex-col gap-2">
            {roles.map((role) => (
              <Badge key={role.id} variant="outline">
                {role.title}
              </Badge>
            ))}
          </div>
        );
      },
    },
    {
      name: 'emailVerified',
      title: t('fields.email_verified'),
      type: 'label',
      placeholder: '-',
    },
    {
      name: 'remainingCredits',
      title: t('fields.remaining_credits'),
      callback: (item) => (
        <div className="text-green-500">{item.remainingCredits ?? 0}</div>
      ),
    },
    { name: 'createdAt', title: t('fields.created_at'), type: 'time' },
    {
      name: 'actions',
      title: t('fields.actions'),
      type: 'dropdown',
      callback: (item) => [
        {
          name: 'edit',
          title: t('list.buttons.edit'),
          icon: 'RiEditLine',
          url: `/admin/users/${item.id}/edit`,
        },
        {
          name: 'edit-roles',
          title: t('list.buttons.edit_roles'),
          icon: 'Users',
          url: `/admin/users/${item.id}/edit-roles`,
        },
      ],
    },
  ],
});
