import type { Footer, Header } from '@/shared/types/blocks/landing';

export const isSiteProductHome = false;

export type SiteProductHomeRouteData = { unavailable: true };

export const resolveSiteProductHomeRouteData = (
  _locale: string
): SiteProductHomeRouteData | null => null;

export const buildSiteProductHomeHeaderFooter = (
  _productHome: SiteProductHomeRouteData
): { header: Header; footer: Footer } => {
  throw new Error('mamamiya does not provide a product home');
};

export const getSiteProductHomeMetadata = (
  _productHome: SiteProductHomeRouteData
): { title: string; description: string } => {
  throw new Error('mamamiya does not provide a product home');
};

export const getSiteProductHomeStructuredData = (
  _productHome: SiteProductHomeRouteData,
  _canonical: string
) => undefined;
