import type { SlugPageTocItem, SlugShellData } from '../slug/slug.types';
import type { TanStackHead } from '@/shared/seo/canonical';


export type BlogPostAdZoneData =
  | {
      provider: 'adsense';
      zone: 'blog_post_inline' | 'blog_post_footer';
      title: string;
      clientId: string;
      slot: string;
    }
  | {
      provider: 'adsterra';
      zone: 'blog_post_inline' | 'blog_post_footer';
      title: string;
      html: string;
    };

export type BlogPostPageData = {
  id: string;
  slug: string;
  title: string;
  description: string;
  content: string;
  createdAt: string;
  authorName: string;
  authorImage: string;
  authorRole: string;
  image: string;
  toc: SlugPageTocItem[];
};

export type BlogPostRouteData = {
  locale: string;
  slug: string;
  canonicalPath: string;
  head: TanStackHead;
  shell: SlugShellData;
  copy: {
    blogLabel: string;
    tocLabel: string;
  };
  adZones: {
    inline: BlogPostAdZoneData | null;
    footer: BlogPostAdZoneData | null;
  };
  post: BlogPostPageData;
};
