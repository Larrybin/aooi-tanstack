// data: admin session (RBAC) + category create form + Server Action write
// cache: no-store (request-bound auth/RBAC)
// reason: admin write flow; avoid caching across users/roles
import { buildAdminCrumbs, setupAdminPage } from '@/app/_admin-support';
import { getTranslations } from 'next-intl/server';

import { FormCard } from '@/shared/blocks/form';
import { Header, Main, MainHeader } from '@/shared/blocks/workspace';
import { PERMISSIONS } from '@/shared/constants/rbac-permissions';
import type { Form } from '@/shared/types/blocks/form';

import { createCategoryAction } from '../actions';

export default async function CategoryAddPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  await setupAdminPage({
    locale,
    permission: PERMISSIONS.CATEGORIES_WRITE,
  });

  const t = await getTranslations('admin.categories');

  const crumbs = buildAdminCrumbs(t, [
    { key: 'add.crumbs.admin', url: '/admin' },
    { key: 'add.crumbs.categories', url: '/admin/categories' },
    { key: 'add.crumbs.add' },
  ]);

  const form: Form = {
    fields: [
      {
        name: 'slug',
        type: 'text',
        title: t('fields.slug'),
        tip: 'unique slug for the category',
        validation: { required: true },
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
      },
    ],
    passby: {
      type: 'category',
    },
    data: {},
    submit: {
      button: {
        title: t('add.buttons.submit'),
      },
      handler: createCategoryAction,
    },
  };

  return (
    <>
      <Header crumbs={crumbs} />
      <Main>
        <MainHeader title={t('add.title')} />
        <FormCard form={form} className="md:max-w-xl" />
      </Main>
    </>
  );
}
