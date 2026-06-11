// data: admin session (RBAC) + user/roles/permissions (db) + Server Action write
// cache: no-store (request-bound auth/RBAC)
// reason: role assignment is sensitive and permission-gated; avoid caching across admins
import { requireAllPagePermissions } from '@/app/[locale]/(admin)/_guards/page-access';
import { accessControlRuntimeDeps } from '@/app/access-control/runtime-deps';
import { accountRuntimeDeps } from '@/app/account/runtime-deps';
import { readAdminUserRoleOptionsUseCase } from '@/domains/access-control/application/checker';
import { readAdminUserQuery } from '@/domains/account/application/admin-user.query';
import { buildAdminCrumbs, setupAdminPage } from '@/app/_admin-support';
import { getTranslations } from 'next-intl/server';

import { Empty } from '@/shared/blocks/common/empty';
import { FormCard } from '@/shared/blocks/form';
import { Header, Main, MainHeader } from '@/shared/blocks/workspace';
import { PERMISSIONS } from '@/shared/constants/rbac-permissions';
import type { Form } from '@/shared/types/blocks/form';

import { updateUserRolesAction } from '../../actions';

export default async function UserEditRolesPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;

  // This page requires multiple permissions, use requireAllPermissions directly
  await setupAdminPage({
    locale,
    permission: PERMISSIONS.USERS_WRITE,
  });
  await requireAllPagePermissions({
    codes: [PERMISSIONS.USERS_WRITE, PERMISSIONS.ROLES_WRITE],
    redirectUrl: '/admin/no-permission',
    locale,
  });

  const t = await getTranslations('admin.users');

  const user = await readAdminUserQuery(id, {
    findUserById: accountRuntimeDeps.findUserById,
  });
  if (!user) {
    return <Empty message={t('errors.not_found')} />;
  }

  const crumbs = buildAdminCrumbs(t, [
    { key: 'edit_roles.crumbs.admin', url: '/admin' },
    { key: 'edit_roles.crumbs.users', url: '/admin/users' },
    { key: 'edit_roles.crumbs.edit_roles' },
  ]);

  const { roles, userRoles } = await readAdminUserRoleOptionsUseCase(
    user.id,
    accessControlRuntimeDeps
  );
  const rolesOptions = roles.map((role) => ({
    title: role.title ?? role.name,
    description: role.description,
    value: role.id,
  }));

  const userRoleIds = userRoles.map((role) => role.id);

  const form: Form<typeof user & { roles: string[] }, { user: typeof user }> = {
    fields: [
      {
        name: 'email',
        type: 'text',
        title: t('fields.email'),
        validation: { required: true },
        attributes: { disabled: true },
      },
      {
        name: 'roles',
        type: 'checkbox',
        title: t('fields.roles'),
        options: rolesOptions,
        validation: { required: true },
      },
    ],
    passby: {
      user,
    },
    data: {
      ...user,
      roles: userRoleIds,
    },
    submit: {
      button: {
        title: t('edit_roles.buttons.submit'),
      },
      handler: updateUserRolesAction.bind(null, id),
    },
  };

  return (
    <>
      <Header crumbs={crumbs} />
      <Main>
        <MainHeader title={t('edit_roles.title')} />
        <FormCard form={form} className="md:max-w-xl" />
      </Main>
    </>
  );
}
