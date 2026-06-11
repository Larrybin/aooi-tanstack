// data: admin session (RBAC) + role/permissions (db) + Server Action write
// cache: no-store (request-bound auth/RBAC)
// reason: permission assignment is sensitive; avoid caching across admins
import { accessControlRuntimeDeps } from '@/app/access-control/runtime-deps';
import { readAdminRolePermissionsQuery } from '@/domains/access-control/application/admin-roles.query';
import { buildAdminCrumbs, setupAdminPage } from '@/app/_admin-support';
import { getTranslations } from 'next-intl/server';

import { Empty } from '@/shared/blocks/common/empty';
import { FormCard } from '@/shared/blocks/form';
import { Header, Main, MainHeader } from '@/shared/blocks/workspace';
import { PERMISSIONS } from '@/shared/constants/rbac-permissions';
import type { Form } from '@/shared/types/blocks/form';

import { updateRolePermissionsAction } from '../../actions';

export default async function RoleEditPermissionsPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;

  await setupAdminPage({
    locale,
    permission: PERMISSIONS.ROLES_WRITE,
  });

  const t = await getTranslations('admin.roles');

  const detail = await readAdminRolePermissionsQuery(
    id,
    accessControlRuntimeDeps
  );
  if (!detail) {
    return <Empty message={t('errors.not_found')} />;
  }
  const { role, permissions, rolePermissions } = detail;

  const crumbs = buildAdminCrumbs(t, [
    { key: 'edit_permissions.crumbs.admin', url: '/admin' },
    { key: 'edit_permissions.crumbs.roles', url: '/admin/roles' },
    { key: 'edit_permissions.crumbs.edit_permissions' },
  ]);

  const permissionsOptions = permissions.map((permission) => ({
    title: permission.title ?? permission.code,
    description: permission.code,
    value: permission.id,
  }));

  const rolePermissionIds = rolePermissions.map((permission) => permission.id);

  const form: Form<
    typeof role & { permissions: string[] },
    { role: typeof role }
  > = {
    fields: [
      {
        name: 'name',
        type: 'text',
        title: t('fields.name'),
        validation: { required: true },
        attributes: { disabled: true },
      },
      {
        name: 'title',
        type: 'text',
        title: t('fields.title'),
        validation: { required: true },
        attributes: { disabled: true },
      },
      {
        name: 'permissions',
        type: 'checkbox',
        title: t('fields.permissions'),
        options: permissionsOptions,
        validation: { required: true },
      },
    ],
    passby: {
      role: role,
    },
    data: {
      ...role,
      permissions: rolePermissionIds,
    },
    submit: {
      button: {
        title: t('edit_permissions.buttons.submit'),
      },
      handler: updateRolePermissionsAction.bind(null, id),
    },
  };

  return (
    <>
      <Header crumbs={crumbs} />
      <Main>
        <MainHeader title={t('edit_permissions.title')} />
        <FormCard form={form} className="md:max-w-xl" />
      </Main>
    </>
  );
}
