import { resolveBackgroundRemoverHomeCopy } from '@/domains/background-remover/ui/background-remover-home-copy';
import { buildBackgroundRemoverHeaderFooter } from '@/domains/background-remover/ui/background-remover-shell';
import { resolveMp4CompressorHomeCopy } from '@/domains/mp4-compressor/ui/mp4-compressor-home-copy';
import { buildMp4CompressorHeaderFooter } from '@/domains/mp4-compressor/ui/mp4-compressor-shell';
import { resolveRemoverHomeCopy } from '@/domains/remover/ui/remover-home-copy';
import { buildRemoverHeaderFooter } from '@/domains/remover/ui/remover-shell';
import { resolveTextToSpeechGeneratorHomeCopy } from '@/domains/text-to-speech-generator/ui/text-to-speech-home-copy';
import { buildTextToSpeechGeneratorHeaderFooter } from '@/domains/text-to-speech-generator/ui/text-to-speech-shell';
import { getServerPublicEnvConfigs } from '@/infra/runtime/env.server';
import { site, siteHomeContent } from '@/site';
import type { ProductHomeRouteData } from '@/surfaces/landing/home/home.types';

import type {
  Footer as FooterType,
  Header as HeaderType,
} from '@/shared/types/blocks/landing';

type HeaderFooter = {
  header: HeaderType;
  footer: FooterType;
};

type SiteHomeContent = Readonly<Record<string, unknown>>;

export function resolveProductHomeRouteData(
  locale: string
): ProductHomeRouteData | null {
  if (!hasStrictHomeContent(locale)) {
    return null;
  }

  switch (getSiteKey()) {
    case 'ai-remover':
      return {
        kind: 'ai-remover',
        copy: resolveRemoverHomeCopy(siteHomeContent, locale),
      };
    case 'background-remover':
      return {
        kind: 'background-remover',
        copy: resolveBackgroundRemoverHomeCopy(siteHomeContent, locale),
      };
    case 'text-to-speech-generator':
      return {
        kind: 'text-to-speech-generator',
        copy: resolveTextToSpeechGeneratorHomeCopy(siteHomeContent, locale),
        turnstileSiteKey: getServerPublicEnvConfigs().turnstileSiteKey,
      };
    case 'mp4-compressor':
      return {
        kind: 'mp4-compressor',
        copy: resolveMp4CompressorHomeCopy(siteHomeContent, locale),
      };
    default:
      return null;
  }
}

export function buildProductHomeHeaderFooter(
  productHome: ProductHomeRouteData
): HeaderFooter {
  const brand = {
    appName: site.brand.appName,
    appLogo: site.brand.logo,
  };

  switch (productHome.kind) {
    case 'ai-remover':
      return buildRemoverHeaderFooter(brand, productHome.copy.shell);
    case 'background-remover':
      return buildBackgroundRemoverHeaderFooter(brand, productHome.copy.shell);
    case 'text-to-speech-generator':
      return buildTextToSpeechGeneratorHeaderFooter(
        brand,
        productHome.copy.shell
      );
    case 'mp4-compressor':
      return buildMp4CompressorHeaderFooter(brand, productHome.copy.shell);
  }
}

export function getProductHomeMetadata(productHome: ProductHomeRouteData) {
  return productHome.copy.metadata;
}

function hasStrictHomeContent(locale: string) {
  const content = siteHomeContent as SiteHomeContent | null;
  return Boolean(content?.[locale]);
}

export function isProductHomeSite() {
  switch (getSiteKey()) {
    case 'ai-remover':
    case 'background-remover':
    case 'text-to-speech-generator':
    case 'mp4-compressor':
      return true;
    default:
      return false;
  }
}

function getSiteKey() {
  return site.key as string;
}
