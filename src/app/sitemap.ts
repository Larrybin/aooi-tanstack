import type { MetadataRoute } from 'next';
import { buildBrandPlaceholderValues } from '@/infra/platform/brand/placeholders.server';
import {
  buildCanonicalUrl,
  getPublishedLocalesForPath,
} from '@/infra/url/canonical';
import { siteI18nPages } from '@/site';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  buildBrandPlaceholderValues();
  const routes = siteI18nPages.pages
    .filter((page) => page.indexable)
    .map((page) => page.path);
  const lastModified = new Date();

  return routes.flatMap((route) =>
    getPublishedLocalesForPath(route).map((locale) => ({
      url: buildCanonicalUrl(route, locale),
      lastModified,
    }))
  );
}
