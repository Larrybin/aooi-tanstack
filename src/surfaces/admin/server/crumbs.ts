import type { Crumb } from '@/shared/types/blocks/common';

type TranslationFunction = (key: string) => string;

export type CrumbSegment = {
  key: string;
  url?: string;
};

export function buildAdminCrumbs(
  t: TranslationFunction,
  segments: CrumbSegment[]
): Crumb[] {
  return segments.map((segment, index) => ({
    title: t(segment.key),
    url: segment.url,
    is_active: index === segments.length - 1,
  }));
}
