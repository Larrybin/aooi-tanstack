import { getLocalPublicContentDocument } from '@/domains/content/application/public-content-manifest';
import enBlog from '@/config/locale/messages/en/blog.json';
import zhBlog from '@/config/locale/messages/zh/blog.json';
import zhTwBlog from '@/config/locale/messages/zh-TW/blog.json';
import { site } from '@/site';

import { resolveLandingShellData } from './landing-shell-data';
import type { BlogPostRouteData } from '@/surfaces/landing/blog-post/blog-post.types';

import {
  buildBrandPlaceholderValues,
  replaceBrandPlaceholders,
} from '@/shared/brand/placeholders';
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

  const post = getLocalPublicContentDocument({
    collection: 'posts',
    slug,
    locale,
  });
  if (!post) {
    return null;
  }

  const messages = blogMessagesByLocale[locale] ?? blogMessagesByLocale.en;
  const brand = buildBrandPlaceholderValues();
  const title = replaceBrandPlaceholders(post.title || slug, brand);
  const description = replaceBrandPlaceholders(
    post.description || messages.metadata.description,
    brand
  );
  const content = replaceBrandPlaceholders(post.content, brand);
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
      id: post.sourcePath,
      slug,
      title,
      description,
      content,
      createdAt: post.created_at,
      authorName: post.author_name,
      authorImage: post.author_image,
      image: post.image,
      toc: post.toc,
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
