import type { TanStackHead } from '@/shared/seo/canonical';

import type { SlugShellData } from '../slug/slug.types';

export type BlogCategoryItem = {
  id: string;
  slug: string;
  title: string;
  description: string;
  url: string;
  isActive?: boolean;
};

export type BlogPostCardItem = {
  id: string;
  slug: string;
  title: string;
  description: string;
  image: string;
  url: string;
  createdAt: string;
  authorName: string;
  authorImage: string;
};

export type BlogCategoryRouteData = {
  locale: string;
  slug: string;
  canonicalPath: string;
  head: TanStackHead;
  shell: SlugShellData;
  copy: {
    allLabel: string;
    emptyLabel: string;
  };
  blog: {
    id: string;
    title: string;
    description: string;
    srOnlyTitle: string;
    categories: BlogCategoryItem[];
    currentCategory: BlogCategoryItem;
    posts: BlogPostCardItem[];
  };
};
