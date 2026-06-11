// data: blog translations + posts/categories (content + db)
// cache: static (generateStaticParams) + default RSC
// reason: public blog listing should be statically prerenderable
import { getBlogPostsAndCategories } from '@/domains/content/application/public-content.query';
import {
  buildBrandPlaceholderValues,
  replaceBrandPlaceholdersDeep,
} from '@/infra/platform/brand/placeholders.server';
import { getLocaleStaticParams } from '@/infra/platform/i18n/static-params';
import { createUseCaseLogger } from '@/infra/platform/logging/logger.server';
import { getMetadata } from '@/app/_metadata/public-page-metadata';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { locales } from '@/config/locale';
import type {
  Blog as BlogType,
  Category as CategoryType,
  Post as PostType,
} from '@/shared/types/blocks/blog';
import BlogPageView from '@/themes/default/pages/blog';

const log = createUseCaseLogger({
  domain: 'content',
  useCase: 'landing-blog-page',
});

export const generateMetadata = getMetadata({
  metadataKey: 'blog.metadata',
  canonicalUrl: '/blog',
});

export function generateStaticParams() {
  return getLocaleStaticParams(locales);
}

export default async function BlogPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  // load blog data
  const t = await getTranslations('blog');

  let posts: PostType[] = [];
  let categories: CategoryType[] = [];

  // current category data
  const currentCategory: CategoryType = {
    id: 'all',
    slug: 'all',
    title: t('page.all'),
    url: `/blog`,
  };

  try {
    const { posts: allPosts, categories: allCategories } =
      await getBlogPostsAndCategories({
        locale,
      });

    posts = allPosts;
    categories = allCategories;

    categories.unshift(currentCategory);
  } catch (error) {
    log.warn('landing: get posts failed', {
      operation: 'render-blog-page',
      route: '/blog',
      locale,
      error,
    });
  }

  // build blog data
  const brand = buildBrandPlaceholderValues();

  const blog: BlogType = {
    ...replaceBrandPlaceholdersDeep(t.raw('blog'), brand),
    categories,
    currentCategory,
    posts,
  };

  return <BlogPageView locale={locale} blog={blog} />;
}
