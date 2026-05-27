import type { MetadataRoute } from 'next';
import { buildBrandPlaceholderValues } from '@/infra/platform/brand/placeholders.server';
import { getSite } from '@/infra/platform/site';
import {
  buildCanonicalUrl,
  getPublishedLocalesForPath,
} from '@/infra/url/canonical';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = getSite();
  buildBrandPlaceholderValues();
  const routes = [
    '/',
    '/pricing',
    ...(site.capabilities.blog ? ['/blog'] : []),
    ...(site.capabilities.docs ? ['/docs'] : []),
  ];
  const lastModified = new Date();

  return routes.flatMap((route) =>
    getPublishedLocalesForPath(route).map((locale) => ({
      url: buildCanonicalUrl(route, locale),
      lastModified,
    }))
  );
}
