// data: admin session (RBAC) + role record (db) + Server Action write (restore)
// cache: no-store (request-bound auth/RBAC)
// reason: sensitive admin action; avoid caching across admins
import { accessControlRuntimeDeps } from '@/app/access-control/runtime-deps';
import { readAdminRoleQuery } from '@/domains/access-control/application/admin-roles.query';
import { buildAdminCrumbs, setupAdminPage } from '@/app/_admin-support';
import { getTranslations } from 'next-intl/server';

import { Empty } from '@/shared/blocks/common/empty';
import { FormCard } from '@/shared/blocks/form';
import { Header, Main, MainHeader } from '@/shared/blocks/workspace';
import { PERMISSIONS } from '@/shared/constants/rbac-permissions';
import type { Form } from '@/shared/types/blocks/form';

import { restoreRoleAction } from '../../actions';

export default async function RoleRestorePage({
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

  const roleRow = await readAdminRoleQuery(id, accessControlRuntimeDeps);
  if (!roleRow) {
    return <Empty message={t('errors.not_found')} />;
  }

  if (!roleRow.deletedAt) {
    return <Empty message={t('errors.not_deleted')} />;
  }

  const crumbs = buildAdminCrumbs(t, [
    { key: 'edit.crumbs.admin', url: '/admin' },
    { key: 'edit.crumbs.roles', url: '/admin/roles?includeDeleted=1' },
    { key: 'restore.crumbs.restore' },
  ]);

  const form: Form<typeof roleRow, { role: typeof roleRow }> = {
    title: t('restore.title'),
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
        name: 'description',
        type: 'textarea',
        title: t('fields.description'),
        validation: { required: true },
        attributes: { disabled: true },
      },
      {
        name: 'deletedAt',
        type: 'text',
        title: t('fields.deleted_at'),
        validation: { required: true },
        attributes: { disabled: true },
      },
    ],
    passby: { role: roleRow },
    data: roleRow,
    submit: {
      button: {
        title: t('restore.buttons.submit'),
      },
      handler: restoreRoleAction.bind(null, id),
    },
  };

  return (
    <>
      <Header crumbs={crumbs} />
      <Main>
        <MainHeader title={t('restore.title')} />
        <FormCard form={form} className="md:max-w-xl" />
      </Main>
    </>
  );
}
