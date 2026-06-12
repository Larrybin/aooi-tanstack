import { getBlogPostsAndCategories } from '@/domains/content/application/public-content.query';
import { site } from '@/site';
import type {
  BlogCategoryItem,
  BlogIndexRouteData,
} from '@/surfaces/landing/blog-index/blog-index.types';

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

type BlogIndexRouteResolverDeps = {
  getBlogPostsAndCategories?: typeof getBlogPostsAndCategories;
};

const blogMessagesByLocale: Record<string, BlogMessages> = {
  en: enBlog,
  zh: zhBlog,
  'zh-TW': zhTwBlog,
};

export async function resolveBlogIndexRouteData(
  {
    locale: localeInput,
  }: {
    locale: unknown;
  },
  deps: BlogIndexRouteResolverDeps = {}
): Promise<BlogIndexRouteData | null> {
  const locale = normalizeLocale(
    typeof localeInput === 'string' ? localeInput : null
  );
  if (!locale || !site.capabilities.blog) {
    return null;
  }

  const canonicalPath = '/blog';
  const loadBlogPostsAndCategories =
    deps.getBlogPostsAndCategories ?? getBlogPostsAndCategories;
  const blogData = await loadBlogPostsAndCategories({
    locale,
    postPrefix: localizedBlogPrefix(locale),
    categoryPrefix: localizedBlogCategoryPrefix(locale),
  });
  const messages = blogMessagesByLocale[locale] ?? blogMessagesByLocale.en;
  const currentCategory: BlogCategoryItem = {
    id: 'all',
    slug: 'all',
    title: messages.page.all,
    description: '',
    url: localizedBlogPath(locale, ''),
    isActive: true,
  };
  const canonical = buildCanonicalUrl(canonicalPath, locale);

  return {
    locale,
    canonicalPath,
    shell: resolveLandingShellData(locale),
    head: buildSeoHead({
      title: messages.metadata.title,
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
      categories: [
        currentCategory,
        ...blogData.categories.map((category) => ({
          id: category.id || category.slug || '',
          slug: category.slug || '',
          title: category.title || category.slug || '',
          description: category.description || '',
          url: localizedBlogCategoryPath(locale, category.slug || ''),
          isActive: false,
        })),
      ],
      currentCategory,
      posts: blogData.posts.map((post) => ({
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
