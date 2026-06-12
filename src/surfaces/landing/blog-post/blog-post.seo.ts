import { site } from '@/site';

import enBlog from '@/config/locale/messages/en/blog.json';
import zhBlog from '@/config/locale/messages/zh/blog.json';
import zhTwBlog from '@/config/locale/messages/zh-TW/blog.json';
import { normalizeLocale } from '@/shared/i18n/locale';
import {
  buildCanonicalUrl,
  buildLanguageAlternates,
  type TanStackHead,
} from '@/shared/seo/canonical';

import type { BlogPostRouteData } from './blog-post.types';

type BlogHeadParams = {
  locale?: unknown;
  slug?: unknown;
};

type BlogMessages = typeof enBlog;

const blogMessagesByLocale: Record<string, BlogMessages> = {
  en: enBlog,
  zh: zhBlog,
  'zh-TW': zhTwBlog,
};

export function getBlogPostSurfaceHead(
  data: BlogPostRouteData | null,
  params?: BlogHeadParams
): TanStackHead {
  return data?.head ?? getMissingBlogPostHead(params);
}

function getMissingBlogPostHead(params?: BlogHeadParams): TanStackHead {
  const locale =
    normalizeLocale(typeof params?.locale === 'string' ? params.locale : null) ??
    'en';
  const slug = typeof params?.slug === 'string' ? normalizeSlug(params.slug) : '';
  const canonicalPath = slug ? `/blog/${slug}` : '/blog';
  const canonical = buildCanonicalUrl(canonicalPath, locale);
  const messages = blogMessagesByLocale[locale] ?? blogMessagesByLocale.en;
  const title = `${slug || 'Blog'} | ${messages.metadata.title}`;
  const alternates = (buildLanguageAlternates(canonicalPath) ?? {}) as Record<
    string,
    string
  >;

  return {
    meta: [
      { title },
      { name: 'description', content: messages.metadata.description },
      { name: 'robots', content: 'noindex,nofollow' },
      { property: 'og:type', content: 'website' },
      { property: 'og:locale', content: locale },
      { property: 'og:url', content: canonical },
      { property: 'og:title', content: title },
      { property: 'og:description', content: messages.metadata.description },
      { property: 'og:site_name', content: site.brand.appName },
    ],
    links: [
      { rel: 'canonical', href: canonical },
      ...Object.entries(alternates).map(
        ([hrefLang, href]) => ({
          rel: 'alternate',
          hrefLang,
          href,
        })
      ),
    ],
  };
}

function normalizeSlug(value: string) {
  return value.trim().replace(/^\/+|\/+$/g, '');
}
