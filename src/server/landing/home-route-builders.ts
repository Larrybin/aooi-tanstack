import {
  readBuildAuthUiSettings,
  readBuildBillingUiSettings,
  readBuildPublicUiConfig,
} from '@/domains/settings/application/settings-build.query';
import { site } from '@/site';
import type {
  GenericHomeRouteData,
  HomeButtonData,
  HomePageData,
  HomeRouteBaseData,
  HomeSectionData,
} from '@/surfaces/landing/home/home.contracts';
import { filterTanStackLandingButtons } from '@/surfaces/public/navigation/landing-visibility';

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
  type TanStackHead,
} from '@/shared/seo/canonical';
import type { Button } from '@/shared/types/blocks/common';
import type { Footer, Header } from '@/shared/types/blocks/landing';

import { buildLandingShellData } from './landing-shell-data';

type LandingMessages = {
  metadata?: { title?: string; description?: string };
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

export function resolvePublishedHomeLocale(localeInput: unknown) {
  const locale = normalizeLocale(
    typeof localeInput === 'string' ? localeInput : null
  );
  return locale && isPublishedLocaleForPath('/', locale) ? locale : null;
}

function buildCommonHomeData({
  locale,
  header,
  footer,
  head,
}: {
  locale: string;
  header: Header;
  footer: Footer;
  head: TanStackHead;
}): HomeRouteBaseData {
  return {
    locale,
    canonicalPath: '/',
    shell: buildLandingShellData({
      header,
      footer,
      locale,
      publicUiConfig: readBuildPublicUiConfig(),
      authSettings: readBuildAuthUiSettings(),
      billingSettings: readBuildBillingUiSettings(),
    }),
    head,
  };
}

export function buildProductSiteHomeRouteData<TProductHome>({
  locale,
  productHome,
  header,
  footer,
  metadata,
  scripts,
}: {
  locale: string;
  productHome: TProductHome;
  header: Header;
  footer: Footer;
  metadata: { title: string; description: string };
  scripts?: TanStackHead['scripts'];
}) {
  const canonical = buildCanonicalUrl('/', locale);
  const head = buildSeoHead({
    title: metadata.title,
    description: metadata.description,
    canonical,
    alternates: buildLanguageAlternates('/'),
    locale,
    siteName: site.brand.appName,
  });

  return {
    ...buildCommonHomeData({
      locale,
      header,
      footer,
      head: { ...head, scripts },
    }),
    productHome,
  };
}

export function resolveGenericSiteHomeRouteData(
  localeInput: unknown
): GenericHomeRouteData | null {
  const locale = resolvePublishedHomeLocale(localeInput);
  if (!locale) return null;
  const messages = landingMessagesByLocale[locale];
  if (!messages) return null;

  const brand = buildBrandPlaceholderValues();
  const publicUiConfig = readBuildPublicUiConfig();
  const page = buildHomePageData(messages, brand, publicUiConfig);
  const title =
    messages.metadata?.title || page.hero?.title || site.brand.appName;
  const description =
    messages.metadata?.description ||
    page.hero?.description ||
    `${site.brand.appName} home page`;
  const canonical = buildCanonicalUrl('/', locale);

  return {
    ...buildCommonHomeData({
      locale,
      header: replaceBrandPlaceholdersDeep(
        messages.header ?? {},
        brand
      ) as Header,
      footer: replaceBrandPlaceholdersDeep(
        messages.footer ?? {},
        brand
      ) as Footer,
      head: buildSeoHead({
        title,
        description,
        canonical,
        alternates: buildLanguageAlternates('/'),
        locale,
        siteName: site.brand.appName,
      }),
    }),
    page,
  };
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
          buttons: filterTanStackLandingButtons(
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
          buttons: filterTanStackLandingButtons(
            cta.buttons as readonly Button[] | undefined,
            publicUiConfig
          ) as HomeButtonData[],
        }
      : undefined,
  };
}
