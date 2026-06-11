import 'server-only';

import { buildBrandPlaceholderValues } from '@/infra/platform/brand/placeholders.server';
import {
  buildCanonicalUrl,
  buildLanguageAlternates,
  buildMetadataBaseUrl,
} from '@/infra/url/canonical';
import { getTranslations, setRequestLocale } from 'next-intl/server';

type MetadataFields = {
  title: string;
  description: string;
  keywords: string;
};

export function getMetadata(
  options: {
    title?: string;
    description?: string;
    keywords?: string;
    metadataKey?: string;
    canonicalUrl?: string;
    imageUrl?: string;
    appName?: string;
    noIndex?: boolean;
  } = {}
) {
  return async function generateMetadata({
    params,
  }: {
    params: Promise<{ locale: string }>;
  }) {
    const { locale } = await params;
    setRequestLocale(locale);

    const brand = buildBrandPlaceholderValues();
    const passedMetadata = {
      title: options.title,
      description: options.description,
      keywords: options.keywords,
    };
    const defaultMetadata = applyBrandToMetadataFields(
      await getTranslatedMetadata(defaultMetadataKey, locale),
      { appName: brand.appName }
    );
    let translatedMetadata: Partial<MetadataFields> = {};

    if (options.metadataKey) {
      translatedMetadata = applyBrandToMetadataFields(
        await getTranslatedMetadata(options.metadataKey, locale),
        { appName: brand.appName }
      );
    }

    const canonicalUrl = buildCanonicalUrl(options.canonicalUrl || '/', locale);
    const canonicalPathForAlternates =
      options.canonicalUrl && options.canonicalUrl.startsWith('http')
        ? undefined
        : options.canonicalUrl || '/';
    const languageAlternates = canonicalPathForAlternates
      ? buildLanguageAlternates(canonicalPathForAlternates)
      : undefined;
    const title =
      passedMetadata.title || translatedMetadata.title || defaultMetadata.title;
    const description =
      passedMetadata.description ||
      translatedMetadata.description ||
      defaultMetadata.description;
    const keywords =
      passedMetadata.keywords ||
      translatedMetadata.keywords ||
      defaultMetadata.keywords;
    const imageUrl = normalizeImageUrl(
      options.imageUrl || brand.appOgImage || '/logo.png',
      brand.appUrl
    );
    const appName = options.appName || brand.appName || '';

    return {
      metadataBase: buildMetadataBaseUrl(),
      title,
      description,
      keywords,
      alternates: {
        canonical: canonicalUrl,
        ...(languageAlternates ? { languages: languageAlternates } : {}),
      },
      icons: {
        icon: brand.appFavicon,
        shortcut: brand.appFavicon,
      },
      openGraph: {
        type: 'website',
        locale,
        url: canonicalUrl,
        title,
        description,
        siteName: appName,
        images: [imageUrl],
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        images: [imageUrl],
        site: brand.appUrl,
      },
      robots: {
        index: options.noIndex ? false : true,
        follow: options.noIndex ? false : true,
      },
    };
  };
}

const defaultMetadataKey = 'common.metadata';

async function getTranslatedMetadata(metadataKey: string, locale: string) {
  setRequestLocale(locale);
  const t = await getTranslations(metadataKey);

  return {
    title: t.has('title') ? t('title') : '',
    description: t.has('description') ? t('description') : '',
    keywords: t.has('keywords') ? t('keywords') : '',
  };
}

function applyBrandToMetadataFields(
  fields: MetadataFields,
  brand: { appName: string }
): MetadataFields {
  const appName = brand.appName;
  if (!appName) return fields;

  return {
    title: fields.title.replaceAll('Roller Rabbit', appName),
    description: fields.description.replaceAll('Roller Rabbit', appName),
    keywords: fields.keywords.replaceAll('Roller Rabbit', appName),
  };
}

function normalizeImageUrl(imageUrl: string, appUrl: string) {
  return imageUrl.startsWith('http') ? imageUrl : `${appUrl}${imageUrl}`;
}
