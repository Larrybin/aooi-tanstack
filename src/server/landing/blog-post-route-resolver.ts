import { getBlogPost } from '@/domains/content/application/public-content.query';
import enBlog from '@/config/locale/messages/en/blog.json';
import zhBlog from '@/config/locale/messages/zh/blog.json';
import zhTwBlog from '@/config/locale/messages/zh-TW/blog.json';
import { site } from '@/site';

import { resolveLandingShellData } from './landing-shell-data';
import type { BlogPostRouteData } from '@/surfaces/landing/blog-post/blog-post.types';

import { normalizeLocale } from '@/shared/i18n/locale';
import {
  buildCanonicalUrl,
  buildLanguageAlternates,
  buildSeoHead,
  isPublishedLocaleForPath,
} from '@/shared/seo/canonical';

type BlogMessages = {
  metadata: {
    title: string;
    description: string;
  };
  page: {
    crumb: string;
    toc: string;
  };
};

const blogMessagesByLocale: Record<string, BlogMessages> = {
  en: enBlog,
  zh: zhBlog,
  'zh-TW': zhTwBlog,
};

export async function resolveBlogPostRouteData({
  locale: localeInput,
  slug: slugInput,
}: {
  locale: unknown;
  slug: unknown;
}): Promise<BlogPostRouteData | null> {
  const locale = normalizeLocale(
    typeof localeInput === 'string' ? localeInput : null
  );
  const slug = normalizeSlug(slugInput);
  if (!locale || !slug) {
    return null;
  }

  const canonicalPath = `/blog/${slug}`;
  if (!isPublishedLocaleForPath(canonicalPath, locale)) {
    return null;
  }

  const post = await getBlogPost({ slug, locale });
  if (!post) {
    return null;
  }

  const messages = blogMessagesByLocale[locale] ?? blogMessagesByLocale.en;
  const title = post.title || slug;
  const description = post.description || messages.metadata.description;
  const canonical = buildCanonicalUrl(canonicalPath, locale);

  return {
    locale,
    slug,
    canonicalPath,
    shell: resolveLandingShellData(locale),
    head: buildSeoHead({
      title: `${title} | ${messages.metadata.title}`,
      description,
      canonical,
      alternates: buildLanguageAlternates(canonicalPath),
      locale,
      siteName: site.brand.appName,
    }),
    copy: {
      blogLabel: messages.page.crumb,
      tocLabel: messages.page.toc,
    },
    post: {
      id: post.id || slug,
      slug: post.slug || slug,
      title,
      description,
      content: post.content || '',
      createdAt: post.created_at || '',
      authorName: post.author_name || '',
      authorImage: post.author_image || '',
      authorRole: post.author_role || '',
      image: post.image || '',
      toc: (post.toc || [])
        .map((item) => ({
          title: typeof item.title === 'string' ? item.title : '',
          url: item.url || '',
          depth: item.depth || 0,
        }))
        .filter((item) => item.title && item.url),
    },
  };
}

function normalizeSlug(value: unknown) {
  if (typeof value !== 'string') {
    return null;
  }

  const slug = value.trim().replace(/^\/+|\/+$/g, '');
  return slug && !slug.includes('/') ? slug : null;
}
