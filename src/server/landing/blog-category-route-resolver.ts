import { getBlogCategoryPostsAndCategories } from '@/domains/content/application/public-content.query';
import { site } from '@/site';
import type {
  BlogCategoryItem,
  BlogCategoryRouteData,
} from '@/surfaces/landing/blog-category/blog-category.types';

import { defaultLocale } from '@/config/locale';
import enBlog from '@/config/locale/messages/en/blog.json';
import zhTwBlog from '@/config/locale/messages/zh-TW/blog.json';
import zhBlog from '@/config/locale/messages/zh/blog.json';
import { normalizeLocale } from '@/shared/i18n/locale';
import {
  buildCanonicalUrl,
  buildLanguageAlternates,
  buildSeoHead,
} from '@/shared/seo/canonical';

import { resolveLandingShellData } from './landing-shell-data';

type BlogMessages = typeof enBlog;

type BlogCategoryRouteResolverDeps = {
  getBlogCategoryPostsAndCategories?: typeof getBlogCategoryPostsAndCategories;
};

const blogMessagesByLocale: Record<string, BlogMessages> = {
  en: enBlog,
  zh: zhBlog,
  'zh-TW': zhTwBlog,
};

export async function resolveBlogCategoryRouteData(
  {
    locale: localeInput,
    slug: slugInput,
  }: {
    locale: unknown;
    slug: unknown;
  },
  deps: BlogCategoryRouteResolverDeps = {}
): Promise<BlogCategoryRouteData | null> {
  const locale = normalizeLocale(
    typeof localeInput === 'string' ? localeInput : null
  );
  const slug = normalizeSlug(slugInput);
  if (!locale || !slug || !site.capabilities.blog) {
    return null;
  }

  const canonicalPath = `/blog/category/${slug}`;
  const loadBlogCategoryPostsAndCategories =
    deps.getBlogCategoryPostsAndCategories ?? getBlogCategoryPostsAndCategories;
  const categoryBlog = await loadBlogCategoryPostsAndCategories({
    slug,
    locale,
    postPrefix: localizedBlogPrefix(locale),
    categoryPrefix: localizedBlogCategoryPrefix(locale),
  });
  if (!categoryBlog) {
    return null;
  }

  const messages = blogMessagesByLocale[locale] ?? blogMessagesByLocale.en;
  const currentCategory = toCategoryItem(
    categoryBlog.currentCategory,
    locale,
    true
  );
  const categories: BlogCategoryItem[] = [
    {
      id: 'all',
      slug: 'all',
      title: messages.page.all,
      description: '',
      url: localizedBlogPath(locale, ''),
      isActive: false,
    },
    ...categoryBlog.categories.map((category) =>
      toCategoryItem(category, locale, category.slug === slug)
    ),
  ];
  const title = currentCategory.title || slug;
  const canonical = buildCanonicalUrl(canonicalPath, locale);

  return {
    locale,
    slug,
    canonicalPath,
    shell: resolveLandingShellData(locale),
    head: buildSeoHead({
      title: `${title} | ${messages.metadata.title}`,
      description: messages.metadata.description,
      canonical,
      alternates: buildLanguageAlternates(canonicalPath),
      locale,
      siteName: site.brand.appName,
    }),
    copy: {
      allLabel: messages.page.all,
      emptyLabel: messages.page.no_content,
    },
    blog: {
      id: messages.blog.id || 'blog',
      title: messages.blog.title || messages.metadata.title,
      description: messages.blog.description || messages.metadata.description,
      srOnlyTitle: messages.blog.sr_only_title || '',
      categories,
      currentCategory,
      posts: categoryBlog.posts.map((post) => ({
        id: post.id || post.slug || '',
        slug: post.slug || '',
        title: post.title || '',
        description: post.description || '',
        image: post.image || '',
        url: localizedBlogPath(locale, post.slug || ''),
        createdAt: post.created_at || '',
        authorName: post.author_name || '',
        authorImage: post.author_image || '',
      })),
    },
  };
}

function toCategoryItem(
  category: {
    id?: string;
    slug?: string;
    title?: string;
    description?: string;
  },
  locale: string,
  isActive: boolean
): BlogCategoryItem {
  const slug = category.slug || '';

  return {
    id: category.id || slug,
    slug,
    title: category.title || slug,
    description: category.description || '',
    url: localizedBlogCategoryPath(locale, slug),
    isActive,
  };
}

function normalizeSlug(value: unknown) {
  if (typeof value !== 'string') {
    return null;
  }

  const slug = value.trim().replace(/^\/+|\/+$/g, '');
  return slug && !slug.includes('/') ? slug : null;
}

function localizedBlogPath(locale: string, slug: string) {
  const prefix = localizedBlogPrefix(locale).replace(/\/$/, '');
  return slug ? `${prefix}/${slug}` : prefix;
}

function localizedBlogCategoryPath(locale: string, slug: string) {
  const prefix = localizedBlogCategoryPrefix(locale).replace(/\/$/, '');
  return slug ? `${prefix}/${slug}` : `${prefix}/`;
}

function localizedBlogPrefix(locale: string) {
  return locale === defaultLocale ? '/blog/' : `/${locale}/blog/`;
}

function localizedBlogCategoryPrefix(locale: string) {
  return locale === defaultLocale
    ? '/blog/category/'
    : `/${locale}/blog/category/`;
}
