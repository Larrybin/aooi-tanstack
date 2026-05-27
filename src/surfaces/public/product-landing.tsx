import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { BackgroundRemoverHome } from '@/domains/background-remover/ui/background-remover-home';
import { buildBackgroundRemoverHeaderFooter } from '@/domains/background-remover/ui/background-remover-shell';
import { RemoverHome } from '@/domains/remover/ui/remover-home';
import type {
  RemoverHomeContent,
} from '@/domains/remover/ui/remover-home-copy';
import { resolveRemoverHomeCopy } from '@/domains/remover/ui/remover-home-copy';
import { buildRemoverHeaderFooter } from '@/domains/remover/ui/remover-shell';
import {
  buildCanonicalUrl,
  buildLanguageAlternates,
  buildMetadataBaseUrl,
} from '@/infra/url/canonical';

import type {
  Footer as FooterType,
  Header as HeaderType,
} from '@/shared/types/blocks/landing';

type ProductLanding = {
  buildHeaderFooter: (
    brand: {
      appName: string;
      appLogo: string;
    },
    context: ProductLandingContext
  ) => { header: HeaderType; footer: FooterType };
  render: (context: ProductLandingContext) => ReactNode;
  metadata: (context: ProductLandingContext) => {
    title: string;
    description: string;
    keywords: readonly string[];
  };
};

type ProductLandingContext = {
  locale: string;
  homeContent: RemoverHomeContent | null;
};

const PRODUCT_LANDINGS = {
  'ai-remover': {
    buildHeaderFooter: (brand, context) =>
      buildRemoverHeaderFooter(
        brand,
        resolveRemoverHomeCopy(context.homeContent, context.locale).shell
      ),
    render: (context) => (
      <RemoverHome
        copy={resolveRemoverHomeCopy(context.homeContent, context.locale)}
        locale={context.locale}
      />
    ),
    metadata: (context) =>
      resolveRemoverHomeCopy(context.homeContent, context.locale).metadata,
  },
  'background-remover': {
    buildHeaderFooter: (brand) => buildBackgroundRemoverHeaderFooter(brand),
    render: () => <BackgroundRemoverHome />,
    metadata: () => ({
      title: 'Background Remover - Transparent PNG Maker',
      description:
        'Remove image backgrounds and create transparent PNG cutouts for product photos, profile images, and design assets.',
      keywords: [
        'remove background',
        'background remover',
        'transparent PNG maker',
        'product image cutout',
        'remove background from image',
      ],
    }),
  },
} as const satisfies Record<string, ProductLanding>;

export function getProductLanding(siteKey: string): ProductLanding | null {
  return PRODUCT_LANDINGS[siteKey as keyof typeof PRODUCT_LANDINGS] ?? null;
}

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
  homeContent: RemoverHomeContent | null;
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
