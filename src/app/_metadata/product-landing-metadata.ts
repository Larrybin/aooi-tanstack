import 'server-only';

import type { Metadata } from 'next';
import {
  buildCanonicalUrl,
  buildLanguageAlternates,
  buildMetadataBaseUrl,
} from '@/infra/url/canonical';
import type { ProductLanding } from '@/surfaces/public/product-landing';

export function buildProductLandingMetadata({
  landing,
  locale,
  brand,
  homeContent,
}: {
  landing: ProductLanding;
  locale: string;
  brand: {
    appName: string;
    appUrl: string;
    appOgImage: string;
  };
  homeContent: unknown;
}): Metadata {
  const metadata = landing.metadata({ locale, homeContent });
  const canonicalUrl = buildCanonicalUrl('/', locale);
  const imageUrl = brand.appOgImage.startsWith('http')
    ? brand.appOgImage
    : `${brand.appUrl}${brand.appOgImage}`;

  return {
    metadataBase: buildMetadataBaseUrl(),
    title: {
      absolute: metadata.title,
    },
    description: metadata.description,
    keywords: [...metadata.keywords],
    alternates: {
      canonical: canonicalUrl,
      languages: buildLanguageAlternates('/'),
    },
    openGraph: {
      type: 'website',
      locale,
      url: canonicalUrl,
      title: metadata.title,
      description: metadata.description,
      siteName: brand.appName,
      images: [imageUrl],
    },
    twitter: {
      card: 'summary_large_image',
      title: metadata.title,
      description: metadata.description,
      images: [imageUrl],
      site: brand.appUrl,
    },
  };
}
