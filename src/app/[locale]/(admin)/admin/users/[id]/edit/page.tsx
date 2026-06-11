// data: admin session (RBAC) + user record (db) + Server Action write
// cache: no-store (request-bound auth/RBAC)
// reason: user edit form is permission-gated and user-specific
import { accountRuntimeDeps } from '@/app/account/runtime-deps';
import { readAdminUserQuery } from '@/domains/account/application/admin-user.query';
import { buildAdminCrumbs, setupAdminPage } from '@/app/_admin-support';
import { getTranslations } from 'next-intl/server';

import { Empty } from '@/shared/blocks/common/empty';
import { FormCard } from '@/shared/blocks/form';
import { Header, Main, MainHeader } from '@/shared/blocks/workspace';
import { PERMISSIONS } from '@/shared/constants/rbac-permissions';
import type { Form } from '@/shared/types/blocks/form';

import { updateUserAction } from '../../actions';

export default async function UserEditPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;

  await setupAdminPage({
    locale,
    permission: PERMISSIONS.USERS_WRITE,
  });

  const t = await getTranslations('admin.users');

  const user = await readAdminUserQuery(id, {
    findUserById: accountRuntimeDeps.findUserById,
  });
  if (!user) {
    return <Empty message={t('errors.not_found')} />;
  }

  const crumbs = buildAdminCrumbs(t, [
    { key: 'edit.crumbs.admin', url: '/admin' },
    { key: 'edit.crumbs.users', url: '/admin/users' },
    { key: 'edit.crumbs.edit' },
  ]);

  const form: Form<typeof user, { user: typeof user }> = {
    fields: [
      {
        name: 'email',
        type: 'text',
        title: t('fields.email'),
        validation: { required: true },
        attributes: { disabled: true },
      },
      {
        name: 'name',
        type: 'text',
        title: t('fields.name'),
        validation: { required: true },
      },
      {
        name: 'image',
        type: 'upload_image',
        title: t('fields.avatar'),
      },
    ],
    passby: {
      user: user,
    },
    data: user,
    submit: {
      button: {
        title: t('edit.buttons.submit'),
      },
      handler: updateUserAction.bind(null, id),
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
