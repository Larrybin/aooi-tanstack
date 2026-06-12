import type { SlugPageTocItem, SlugShellData } from '../slug/slug.types';
import type { TanStackHead } from '@/shared/seo/canonical';

export type BlogPostPageData = {
  id: string;
  slug: string;
  title: string;
  description: string;
  content: string;
  createdAt: string;
  authorName: string;
  authorImage: string;
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
  post: BlogPostPageData;
};
