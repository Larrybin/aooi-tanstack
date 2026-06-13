import type { BackgroundRemoverHomeCopy } from '@/domains/background-remover/ui/background-remover-home-copy';
import type { Mp4CompressorHomeCopy } from '@/domains/mp4-compressor/ui/mp4-compressor-home-copy';
import type { RemoverHomeCopy } from '@/domains/remover/ui/remover-home-copy';
import type { TextToSpeechGeneratorHomeCopy } from '@/domains/text-to-speech-generator/ui/text-to-speech-home-copy';

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

export type ProductHomeRouteData =
  | {
      kind: 'ai-remover';
      copy: RemoverHomeCopy;
    }
  | {
      kind: 'background-remover';
      copy: BackgroundRemoverHomeCopy;
    }
  | {
      kind: 'text-to-speech-generator';
      copy: TextToSpeechGeneratorHomeCopy;
      turnstileSiteKey: string;
    }
  | {
      kind: 'mp4-compressor';
      copy: Mp4CompressorHomeCopy;
    };

type HomeRouteBaseData = {
  locale: string;
  canonicalPath: '/';
  head: TanStackHead;
  shell: SlugShellData;
};

export type HomeRouteData = HomeRouteBaseData &
  (
    | {
        variant: 'generic';
        page: HomePageData;
      }
    | {
        variant: 'product';
        productHome: ProductHomeRouteData;
      }
  );
