import type { TanStackHead } from '@/shared/seo/canonical';

export type SlugPageTocItem = {
  title: string;
  url: string;
  depth: number;
};

export type SlugPageData = {
  id: string;
  slug: string;
  title: string;
  description: string;
  content: string;
  createdAt: string;
  toc: SlugPageTocItem[];
};

export type SlugRouteData = {
  locale: string;
  slug: string;
  canonicalPath: string;
  head: TanStackHead;
  page: SlugPageData;
};
