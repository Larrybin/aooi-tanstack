// data: admin session (RBAC) + post create form + categories (db) + Server Action write
// cache: no-store (request-bound auth/RBAC)
// reason: admin write flow; avoid caching across users/roles
import { getTaxonomies } from '@/domains/content/application/taxonomy.query';
import {
  TaxonomyStatus,
  TaxonomyType,
} from '@/domains/content/domain/taxonomy-types';
import { buildAdminCrumbs, setupAdminPage } from '@/app/_admin-support';
import { getTranslations } from 'next-intl/server';

import { FormCard } from '@/shared/blocks/form';
import { Header, Main, MainHeader } from '@/shared/blocks/workspace';
import { PERMISSIONS } from '@/shared/constants/rbac-permissions';
import type { Form } from '@/shared/types/blocks/form';

import { createPostAction } from '../actions';

export default async function PostAddPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  await setupAdminPage({
    locale,
    permission: PERMISSIONS.POSTS_WRITE,
  });

  const t = await getTranslations('admin.posts');

  const crumbs = buildAdminCrumbs(t, [
    { key: 'add.crumbs.admin', url: '/admin' },
    { key: 'add.crumbs.posts', url: '/admin/posts' },
    { key: 'add.crumbs.add' },
  ]);

  const categories = await getTaxonomies({
    type: TaxonomyType.CATEGORY,
    status: TaxonomyStatus.PUBLISHED,
  });
  const categoriesOptions = [
    ...categories.map((category) => ({
      title: category.title,
      value: category.id,
    })),
  ];

  const form: Form = {
    fields: [
      {
        name: 'slug',
        type: 'text',
        title: t('fields.slug'),
        tip: 'unique slug for the post',
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
      {
        name: 'categories',
        type: 'select',
        title: t('fields.categories'),
        options: categoriesOptions,
      },
      {
        name: 'image',
        type: 'upload_image',
        title: t('fields.image'),
        metadata: {
          max: 1,
        },
      },
      {
        name: 'authorName',
        type: 'text',
        title: t('fields.author_name'),
      },
      {
        name: 'authorImage',
        type: 'upload_image',
        title: t('fields.author_image'),
      },
      {
        name: 'content',
        type: 'markdown_editor',
        title: t('fields.content'),
      },
    ],
    passby: {
      type: 'post',
    },
    data: {},
    submit: {
      button: {
        title: t('add.buttons.submit'),
      },
      handler: createPostAction,
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
