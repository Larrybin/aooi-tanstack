import type { SlugRouteData } from './slug.types';

export function getSlugSurfaceHead(data: SlugRouteData | null) {
  return data?.head ?? {};
}
