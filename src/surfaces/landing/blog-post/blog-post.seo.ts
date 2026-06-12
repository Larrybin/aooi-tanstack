import type { BlogPostRouteData } from './blog-post.types';

export function getBlogPostSurfaceHead(data: BlogPostRouteData | null) {
  return data?.head ?? {};
}
