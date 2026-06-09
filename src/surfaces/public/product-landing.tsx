import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { BackgroundRemoverHome } from '@/domains/background-remover/ui/background-remover-home';
import { resolveBackgroundRemoverHomeCopy } from '@/domains/background-remover/ui/background-remover-home-copy';
import { buildBackgroundRemoverHeaderFooter } from '@/domains/background-remover/ui/background-remover-shell';
import { RemoverHome } from '@/domains/remover/ui/remover-home';
import { resolveRemoverHomeCopy } from '@/domains/remover/ui/remover-home-copy';
import { buildRemoverHeaderFooter } from '@/domains/remover/ui/remover-shell';
import { TextToSpeechGeneratorHome } from '@/domains/text-to-speech-generator/ui/text-to-speech-home';
import { resolveTextToSpeechGeneratorHomeCopy } from '@/domains/text-to-speech-generator/ui/text-to-speech-home-copy';
import { buildTextToSpeechGeneratorHeaderFooter } from '@/domains/text-to-speech-generator/ui/text-to-speech-shell';
import { getServerPublicEnvConfigs } from '@/infra/runtime/env.server';
import { Mp4CompressorHome } from '@/domains/mp4-compressor/ui/mp4-compressor-home';
import { resolveMp4CompressorHomeCopy } from '@/domains/mp4-compressor/ui/mp4-compressor-home-copy';
import { buildMp4CompressorHeaderFooter } from '@/domains/mp4-compressor/ui/mp4-compressor-shell';
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
  homeContent: unknown;
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
    buildHeaderFooter: (brand, context) =>
      buildBackgroundRemoverHeaderFooter(
        brand,
        resolveBackgroundRemoverHomeCopy(context.homeContent, context.locale)
          .shell
      ),
    render: (context) => (
      <BackgroundRemoverHome
        copy={resolveBackgroundRemoverHomeCopy(
          context.homeContent,
          context.locale
        )}
        locale={context.locale}
      />
    ),
    metadata: (context) =>
      resolveBackgroundRemoverHomeCopy(context.homeContent, context.locale)
        .metadata,
  },
  'text-to-speech-generator': {
    buildHeaderFooter: (brand, context) =>
      buildTextToSpeechGeneratorHeaderFooter(
        brand,
        resolveTextToSpeechGeneratorHomeCopy(
          context.homeContent,
          context.locale
        ).shell
      ),
    render: (context) => (
      <TextToSpeechGeneratorHome
        copy={resolveTextToSpeechGeneratorHomeCopy(
          context.homeContent,
          context.locale
        )}
        locale={context.locale}
        turnstileSiteKey={getServerPublicEnvConfigs().turnstileSiteKey}
      />
    ),
    metadata: (context) =>
      resolveTextToSpeechGeneratorHomeCopy(context.homeContent, context.locale)
        .metadata,
  },
  'mp4-compressor': {
    buildHeaderFooter: (brand, context) =>
      buildMp4CompressorHeaderFooter(
        brand,
        resolveMp4CompressorHomeCopy(context.homeContent, context.locale).shell
      ),
    render: (context) => (
      <Mp4CompressorHome
        copy={resolveMp4CompressorHomeCopy(
          context.homeContent,
          context.locale
        )}
        locale={context.locale}
      />
    ),
    metadata: (context) =>
      resolveMp4CompressorHomeCopy(context.homeContent, context.locale)
        .metadata,
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
