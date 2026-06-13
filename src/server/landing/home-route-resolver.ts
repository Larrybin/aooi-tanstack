import {
  readBuildAuthUiSettings,
  readBuildBillingUiSettings,
  readBuildPublicUiConfig,
} from '@/domains/settings/application/settings-build.query';
import { site } from '@/site';
import type {
  HomeButtonData,
  HomePageData,
  HomeRouteData,
  HomeSectionData,
} from '@/surfaces/landing/home/home.types';
import { filterLandingButtons } from '@/surfaces/public/navigation/landing-visibility';

import enLanding from '@/config/locale/messages/en/landing.json';
import zhTwLanding from '@/config/locale/messages/zh-TW/landing.json';
import zhLanding from '@/config/locale/messages/zh/landing.json';
import {
  buildBrandPlaceholderValues,
  replaceBrandPlaceholdersDeep,
} from '@/shared/brand/placeholders';
import { normalizeLocale } from '@/shared/i18n/locale';
import {
  buildCanonicalUrl,
  buildLanguageAlternates,
  buildSeoHead,
  isPublishedLocaleForPath,
} from '@/shared/seo/canonical';
import type { Button } from '@/shared/types/blocks/common';
import type { Footer, Header } from '@/shared/types/blocks/landing';

import { buildLandingShellData } from './landing-shell-data';
import {
  buildProductHomeHeaderFooter,
  getProductHomeMetadata,
  isProductHomeSite,
  resolveProductHomeRouteData,
} from './product-home-route-data';

type LandingMessages = {
  metadata?: {
    title?: string;
    description?: string;
  };
  header?: unknown;
  footer?: unknown;
  hero?: unknown;
  logos?: unknown;
  introduce?: unknown;
  benefits?: unknown;
  usage?: unknown;
  features?: unknown;
  stats?: unknown;
  subscribe?: unknown;
  testimonials?: unknown;
  faq?: unknown;
  cta?: unknown;
};

const landingMessagesByLocale: Record<string, LandingMessages> = {
  en: enLanding,
  zh: zhLanding,
  'zh-TW': zhTwLanding,
};

export async function resolveHomeRouteData({
  locale: localeInput,
}: {
  locale: unknown;
}): Promise<HomeRouteData | null> {
  const locale = normalizeLocale(
    typeof localeInput === 'string' ? localeInput : null
  );
  if (!locale || !isPublishedLocaleForPath('/', locale)) {
    return null;
  }

  const publicUiConfig = readBuildPublicUiConfig();
  const authSettings = readBuildAuthUiSettings();
  const billingSettings = readBuildBillingUiSettings();
  const brand = buildBrandPlaceholderValues();

  if (isProductHomeSite()) {
    const productHome = resolveProductHomeRouteData(locale);
    if (!productHome) {
      return null;
    }

    const metadata = getProductHomeMetadata(productHome);
    const canonical = buildCanonicalUrl('/', locale);

    return JSON.parse(
      JSON.stringify({
        locale,
        canonicalPath: '/',
        shell: buildLandingShellData({
          ...buildProductHomeHeaderFooter(productHome),
          locale,
          publicUiConfig,
          authSettings,
          billingSettings,
        }),
        head: buildSeoHead({
          title: metadata.title,
          description: metadata.description,
          canonical,
          alternates: buildLanguageAlternates('/'),
          locale,
          siteName: site.brand.appName,
        }),
        variant: 'product',
        productHome,
      })
    ) as HomeRouteData;
  }

  const messages = getLandingMessages(locale);
  if (!messages) {
    return null;
  }

  const shell = buildLandingShellData({
    header: replaceBrandPlaceholdersDeep(
      messages.header ?? {},
      brand
    ) as Header,
    footer: replaceBrandPlaceholdersDeep(
      messages.footer ?? {},
      brand
    ) as Footer,
    locale,
    publicUiConfig,
    authSettings,
    billingSettings,
  });
  const page = buildHomePageData(messages, brand, publicUiConfig);
  const title =
    messages.metadata?.title || page.hero?.title || site.brand.appName;
  const description =
    messages.metadata?.description ||
    page.hero?.description ||
    `${site.brand.appName} home page`;
  const canonical = buildCanonicalUrl('/', locale);

  return JSON.parse(
    JSON.stringify({
      locale,
      canonicalPath: '/',
      shell,
      head: buildSeoHead({
        title,
        description,
        canonical,
        alternates: buildLanguageAlternates('/'),
        locale,
        siteName: site.brand.appName,
      }),
      variant: 'generic',
      page,
    })
  ) as HomeRouteData;
}

function getLandingMessages(locale: string): LandingMessages | null {
  return landingMessagesByLocale[locale] ?? null;
}

function buildHomePageData(
  messages: LandingMessages,
  brand: ReturnType<typeof buildBrandPlaceholderValues>,
  publicUiConfig: ReturnType<typeof readBuildPublicUiConfig>
): HomePageData {
  const hero = replaceBrandPlaceholdersDeep(
    messages.hero,
    brand
  ) as HomeSectionData;
  const cta = replaceBrandPlaceholdersDeep(
    messages.cta,
    brand
  ) as HomeSectionData;

  return {
    hero: hero
      ? {
          ...hero,
          buttons: filterLandingButtons(
            hero.buttons as readonly Button[] | undefined,
            publicUiConfig
          ) as HomeButtonData[],
        }
      : undefined,
    logos: replaceBrandPlaceholdersDeep(
      messages.logos,
      brand
    ) as HomeSectionData,
    introduce: replaceBrandPlaceholdersDeep(
      messages.introduce,
      brand
    ) as HomeSectionData,
    benefits: replaceBrandPlaceholdersDeep(
      messages.benefits,
      brand
    ) as HomeSectionData,
    usage: replaceBrandPlaceholdersDeep(
      messages.usage,
      brand
    ) as HomeSectionData,
    features: replaceBrandPlaceholdersDeep(
      messages.features,
      brand
    ) as HomeSectionData,
    stats: replaceBrandPlaceholdersDeep(
      messages.stats,
      brand
    ) as HomeSectionData,
    subscribe: replaceBrandPlaceholdersDeep(
      messages.subscribe,
      brand
    ) as HomeSectionData,
    testimonials: replaceBrandPlaceholdersDeep(
      messages.testimonials,
      brand
    ) as HomeSectionData,
    faq: replaceBrandPlaceholdersDeep(messages.faq, brand) as HomeSectionData,
    cta: cta
      ? {
          ...cta,
          buttons: filterLandingButtons(
            cta.buttons as readonly Button[] | undefined,
            publicUiConfig
          ) as HomeButtonData[],
        }
      : undefined,
  };
}
