// data: admin session (RBAC) + role record (db) + Server Action write
// cache: no-store (request-bound auth/RBAC)
// reason: role metadata is permission-gated; avoid caching across admins
import { accessControlRuntimeDeps } from '@/app/access-control/runtime-deps';
import { readAdminRoleQuery } from '@/domains/access-control/application/admin-roles.query';
import { buildAdminCrumbs, setupAdminPage } from '@/app/_admin-support';
import { getTranslations } from 'next-intl/server';

import { Empty } from '@/shared/blocks/common/empty';
import { FormCard } from '@/shared/blocks/form';
import { Header, Main, MainHeader } from '@/shared/blocks/workspace';
import { PERMISSIONS } from '@/shared/constants/rbac-permissions';
import type { Form } from '@/shared/types/blocks/form';

import { updateRoleAction } from '../../actions';

export default async function RoleEditPage({
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

  const role = await readAdminRoleQuery(id, accessControlRuntimeDeps);
  if (!role) {
    return <Empty message={t('errors.not_found')} />;
  }

  const crumbs = buildAdminCrumbs(t, [
    { key: 'edit.crumbs.admin', url: '/admin' },
    { key: 'edit.crumbs.roles', url: '/admin/roles' },
    { key: 'edit.crumbs.edit' },
  ]);

  const form: Form<typeof role, { role: typeof role }> = {
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
      },
      {
        name: 'description',
        type: 'textarea',
        title: t('fields.description'),
        validation: { required: true },
      },
    ],
    passby: {
      role: role,
    },
    data: role,
    submit: {
      button: {
        title: t('edit.buttons.submit'),
      },
      handler: updateRoleAction.bind(null, id),
    },
  };

  return (
    <>
      <Header crumbs={crumbs} />
      <Main>
        <MainHeader title={t('edit.title')} />
        <FormCard form={form} className="md:max-w-xl" />
      </Main>
    </>
  );
}
