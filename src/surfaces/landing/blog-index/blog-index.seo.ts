import { site } from '@/site';

import enBlog from '@/config/locale/messages/en/blog.json';
import zhTwBlog from '@/config/locale/messages/zh-TW/blog.json';
import zhBlog from '@/config/locale/messages/zh/blog.json';
import { normalizeLocale } from '@/shared/i18n/locale';
import {
  buildCanonicalUrl,
  buildLanguageAlternates,
  type TanStackHead,
} from '@/shared/seo/canonical';

import type { BlogIndexRouteData } from './blog-index.types';

type BlogIndexHeadParams = {
  locale?: unknown;
};

type BlogMessages = typeof enBlog;

const blogMessagesByLocale: Record<string, BlogMessages> = {
  en: enBlog,
  zh: zhBlog,
  'zh-TW': zhTwBlog,
};

export function getBlogIndexSurfaceHead(
  data: BlogIndexRouteData | null,
  params?: BlogIndexHeadParams
): TanStackHead {
  return data?.head ?? getMissingBlogIndexHead(params);
}

function getMissingBlogIndexHead(params?: BlogIndexHeadParams): TanStackHead {
  const locale =
    normalizeLocale(
      typeof params?.locale === 'string' ? params.locale : null
    ) ?? 'en';
  const canonicalPath = '/blog';
  const canonical = buildCanonicalUrl(canonicalPath, locale);
  const messages = blogMessagesByLocale[locale] ?? blogMessagesByLocale.en;
  const alternates = (buildLanguageAlternates(canonicalPath) ?? {}) as Record<
    string,
    string
  >;

  return {
    meta: [
      { title: messages.metadata.title },
      { name: 'description', content: messages.metadata.description },
      { name: 'robots', content: 'noindex,nofollow' },
      { property: 'og:type', content: 'website' },
      { property: 'og:locale', content: locale },
      { property: 'og:url', content: canonical },
      { property: 'og:title', content: messages.metadata.title },
      { property: 'og:description', content: messages.metadata.description },
      { property: 'og:site_name', content: site.brand.appName },
    ],
    links: [
      { rel: 'canonical', href: canonical },
      ...Object.entries(alternates).map(([hrefLang, href]) => ({
        rel: 'alternate',
        hrefLang,
        href,
      })),
    ],
  };
}
