// data: admin session (RBAC) + post record (db) + categories (db) + Server Action write
// cache: no-store (request-bound auth/RBAC)
// reason: admin write flow; avoid caching across users/roles
import { findPost } from '@/domains/content/application/post.query';
import { getTaxonomies } from '@/domains/content/application/taxonomy.query';
import {
  TaxonomyStatus,
  TaxonomyType,
} from '@/domains/content/domain/taxonomy-types';
import { buildAdminCrumbs, setupAdminPage } from '@/app/_admin-support';
import { getTranslations } from 'next-intl/server';

import { Empty } from '@/shared/blocks/common/empty';
import { FormCard } from '@/shared/blocks/form';
import { Header, Main, MainHeader } from '@/shared/blocks/workspace';
import { PERMISSIONS } from '@/shared/constants/rbac-permissions';
import type { Form } from '@/shared/types/blocks/form';

import { updatePostAction } from '../../actions';

export default async function PostEditPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;

  await setupAdminPage({
    locale,
    permission: PERMISSIONS.POSTS_WRITE,
  });

  const t = await getTranslations('admin.posts');

  const post = await findPost({ id });
  if (!post) {
    return <Empty message={t('errors.not_found')} />;
  }

  const crumbs = buildAdminCrumbs(t, [
    { key: 'edit.crumbs.admin', url: '/admin' },
    { key: 'edit.crumbs.posts', url: '/admin/posts' },
    { key: 'edit.crumbs.edit' },
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

  const form: Form<typeof post, { type: 'post'; post: typeof post }> = {
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
      post: post,
    },
    data: post,
    submit: {
      button: {
        title: t('edit.buttons.submit'),
      },
      handler: updatePostAction.bind(null, id),
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
