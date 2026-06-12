import type { TanStackHead } from '@/shared/seo/canonical';
import type { Image } from '@/shared/types/blocks/common';

import type { SlugShellData } from '../slug/slug.types';

export type HomeItemData = {
  id?: string;
  name?: string;
  title?: string;
  text?: string;
  description?: string;
  url?: string;
  target?: string;
  type?: string;
  icon?: string;
  badge?: string;
  image?: Image;
  question?: string;
  answer?: string;
  role?: string;
  quote?: string;
  avatar?: Image;
  children?: HomeItemData[];
};

export type HomeButtonData = HomeItemData & {
  size?: 'default' | 'sm' | 'lg' | 'icon';
  variant?: string;
};

export type HomeFormFieldData = {
  name?: string;
  title?: string;
  type?: string;
  placeholder?: string;
  group?: string;
  value?: string | number | boolean | string[];
  tip?: string;
  options?: Array<{
    title: string;
    value: string;
    description?: string | null;
  }>;
  validation?: {
    required?: boolean;
    min?: number;
    max?: number;
    message?: string;
    email?: boolean;
  };
};

export type HomeFormSubmitData = {
  input?: HomeFormFieldData;
  button?: HomeButtonData;
  action?: string;
};

export type HomeSectionData = {
  id?: string;
  block?: string;
  label?: string;
  sr_only_title?: string;
  title?: string;
  description?: string;
  tip?: string;
  buttons?: HomeButtonData[];
  icon?: string;
  image?: Image;
  image_invert?: Image;
  items?: HomeItemData[];
  image_position?: 'left' | 'right' | 'top' | 'bottom' | 'center';
  text_align?: 'left' | 'center' | 'right';
  className?: string;
  submit?: HomeFormSubmitData;
};

export type HomePageData = {
  hero?: HomeSectionData;
  logos?: HomeSectionData;
  introduce?: HomeSectionData;
  benefits?: HomeSectionData;
  usage?: HomeSectionData;
  features?: HomeSectionData;
  stats?: HomeSectionData;
  subscribe?: HomeSectionData;
  testimonials?: HomeSectionData;
  faq?: HomeSectionData;
  cta?: HomeSectionData;
  sections?: HomeSectionData[];
};

export type HomeRouteData = {
  locale: string;
  canonicalPath: '/';
  head: TanStackHead;
  shell: SlugShellData;
  page: HomePageData;
};
