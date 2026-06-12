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
  const post = await getBlogPost({ slug, locale });
  if (!post) {
    return null;
  }

  const messages = blogMessagesByLocale[locale] ?? blogMessagesByLocale.en;
  const title = post.title || slug;
  const description = post.description || messages.metadata.description;
  const canonical = buildCanonicalUrl(canonicalPath, locale);
  const adZones = await resolveBlogPostAdZones();

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
    adZones,
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


type BlogPostAdZoneName = 'blog_post_inline' | 'blog_post_footer';

type BlogPostAdZoneData = NonNullable<BlogPostRouteData['adZones']['inline']>;

const blogPostAdZoneTitles: Record<BlogPostAdZoneName, string> = {
  blog_post_inline: 'Blog Post Inline',
  blog_post_footer: 'Blog Post Footer',
};

async function resolveBlogPostAdZones(): Promise<BlogPostRouteData['adZones']> {
  const [{ readAdsRuntimeSettingsCached }, { isDebugEnv, isProductionEnv }] =
    await Promise.all([
      import('@/domains/settings/application/settings-runtime.query'),
      import('@/shared/lib/env'),
    ]);
  const settings = await readAdsRuntimeSettingsCached();

  if (!settings.adsEnabled || (!isProductionEnv() && !isDebugEnv())) {
    return { inline: null, footer: null };
  }

  if (settings.adsProvider === 'adsense') {
    return {
      inline: buildAdsenseAdZone({
        zone: 'blog_post_inline',
        clientId: settings.adsenseClientId,
        slot: settings.adsenseSlotBlogPostInline,
      }),
      footer: buildAdsenseAdZone({
        zone: 'blog_post_footer',
        clientId: settings.adsenseClientId,
        slot: settings.adsenseSlotBlogPostFooter,
      }),
    };
  }

  if (
    settings.adsProvider === 'adsterra' &&
    (settings.adsterraMode === 'native_banner' ||
      settings.adsterraMode === 'display_banner')
  ) {
    return {
      inline: await buildAdsterraAdZone({
        zone: 'blog_post_inline',
        snippet: settings.adsterraZoneBlogPostInlineSnippet,
      }),
      footer: await buildAdsterraAdZone({
        zone: 'blog_post_footer',
        snippet: settings.adsterraZoneBlogPostFooterSnippet,
      }),
    };
  }

  return { inline: null, footer: null };
}

function buildAdsenseAdZone({
  zone,
  clientId,
  slot,
}: {
  zone: BlogPostAdZoneName;
  clientId: string;
  slot: string;
}): BlogPostAdZoneData | null {
  if (!clientId || !slot) {
    return null;
  }

  return {
    provider: 'adsense',
    zone,
    title: blogPostAdZoneTitles[zone],
    clientId,
    slot,
  };
}

async function buildAdsterraAdZone({
  zone,
  snippet,
}: {
  zone: BlogPostAdZoneName;
  snippet: string;
}): Promise<BlogPostAdZoneData | null> {
  const normalizedSnippet = snippet.trim();
  if (!normalizedSnippet) {
    return null;
  }

  const [{ renderAdsterraSnippet }, { renderToStaticMarkup }] =
    await Promise.all([
      import('@/extensions/ads/adsterra-snippet.server'),
      import('react-dom/server'),
    ]);
  const parsedSnippet = renderAdsterraSnippet(
    normalizedSnippet,
    `tanstack-blog-post-${zone}`
  );
  if (!parsedSnippet.ok) {
    return null;
  }

  const html = renderToStaticMarkup(parsedSnippet.node);
  if (!html) {
    return null;
  }

  return {
    provider: 'adsterra',
    zone,
    title: blogPostAdZoneTitles[zone],
    html,
  };
}
