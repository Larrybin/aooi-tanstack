import { resolveBackgroundRemoverHomeCopy } from '@/domains/background-remover/ui/background-remover-home-copy';
import { buildBackgroundRemoverHeaderFooter } from '@/domains/background-remover/ui/background-remover-shell';
import { getLocalPublicContentDocument } from '@/domains/content/application/public-content-manifest';
import { resolveMp4CompressorHomeCopy } from '@/domains/mp4-compressor/ui/mp4-compressor-home-copy';
import { buildMp4CompressorHeaderFooter } from '@/domains/mp4-compressor/ui/mp4-compressor-shell';
import { resolveRemoverHomeCopy } from '@/domains/remover/ui/remover-home-copy';
import { buildRemoverHeaderFooter } from '@/domains/remover/ui/remover-shell';
import type {
  AuthUiRuntimeSettings,
  BillingRuntimeSettings,
  PublicUiConfig,
} from '@/domains/settings/application/settings-runtime.contracts';
import { resolveTextToSpeechGeneratorHomeCopy } from '@/domains/text-to-speech-generator/ui/text-to-speech-home-copy';
import { buildTextToSpeechGeneratorHeaderFooter } from '@/domains/text-to-speech-generator/ui/text-to-speech-shell';
import {
  site,
  siteHomeContent,
  siteLocalizedPricing,
  sitePricing,
} from '@/site';
import type {
  SerializablePublicUiConfig,
  SerializablePublicUiNavItem,
  SlugShellData,
  SlugShellNavItem,
} from '@/surfaces/landing/slug/slug.types';
import {
  filterLandingButtons,
  filterLandingNavItems,
} from '@/surfaces/public/navigation/landing-visibility';

import { defaultLocale } from '@/config/locale';
import enCommon from '@/config/locale/messages/en/common.json';
import jaCommon from '@/config/locale/messages/ja/common.json';
import zhTwCommon from '@/config/locale/messages/zh-TW/common.json';
import zhCommon from '@/config/locale/messages/zh/common.json';
import type { NavItem } from '@/shared/types/blocks/common';
import type {
  Footer as FooterType,
  Header as HeaderType,
} from '@/shared/types/blocks/landing';
import type { SitePricing } from '@/shared/types/blocks/pricing';

type HeaderFooter = {
  header: HeaderType;
  footer: FooterType;
};

type SupportedCommonMessages = {
  sign?: {
    sign_in_title?: string;
  };
};

type SiteLocalizedPricing = Record<string, SitePricing | undefined>;

const commonMessagesByLocale: Record<string, SupportedCommonMessages> = {
  en: enCommon,
  ja: jaCommon,
  zh: zhCommon,
  'zh-TW': zhTwCommon,
};

export function resolveLandingShellData(locale: string): SlugShellData {
  const productShell = resolveProductHeaderFooter(locale);

  if (productShell) {
    return buildLandingShellData({
      ...productShell,
      locale,
      publicUiConfig: buildPublicUiConfig(),
      authSettings: buildAuthSettings(),
      billingSettings: buildBillingSettings(),
    });
  }

  return buildFallbackShellData(locale);
}

export function resolveProductHeaderFooter(
  locale: string
): HeaderFooter | null {
  if (!siteHomeContent) {
    return null;
  }

  const brand = {
    appName: site.brand.appName,
    appLogo: site.brand.logo,
  };

  const siteKey = site.key as string;

  switch (siteKey) {
    case 'ai-remover':
      return buildRemoverHeaderFooter(
        brand,
        resolveRemoverHomeCopy(siteHomeContent, locale).shell
      );
    case 'background-remover':
      return buildBackgroundRemoverHeaderFooter(
        brand,
        resolveBackgroundRemoverHomeCopy(siteHomeContent, locale).shell
      );
    case 'text-to-speech-generator':
      return buildTextToSpeechGeneratorHeaderFooter(
        brand,
        resolveTextToSpeechGeneratorHomeCopy(siteHomeContent, locale).shell
      );
    case 'mp4-compressor':
      return buildMp4CompressorHeaderFooter(
        brand,
        resolveMp4CompressorHomeCopy(siteHomeContent, locale).shell
      );
    default:
      return null;
  }
}

export function buildLandingShellData({
  header,
  footer,
  locale,
  publicUiConfig,
  authSettings,
  billingSettings,
}: {
  header: HeaderType;
  footer: FooterType;
  locale: string;
  publicUiConfig: PublicUiConfig;
  authSettings: AuthUiRuntimeSettings;
  billingSettings: BillingRuntimeSettings;
}): SlugShellData {
  const brand = header.brand ?? footer.brand;
  const agreementItems = footer.agreement?.items ?? [];
  const headerNavItems = filterTanStackShellNavItems(
    filterLandingNavItems(header.nav?.items, publicUiConfig)
  );
  const headerButtonItems = filterTanStackShellNavItems(
    filterLandingButtons(header.buttons, publicUiConfig)
  );
  const footerNavItems = filterTanStackShellNavItems(
    filterLandingNavItems(footer.nav?.items, publicUiConfig)
  );

  return {
    publicUiConfig: toSerializablePublicUiConfig(publicUiConfig),
    authSettings,
    billingSettings,
    brand: {
      title: brand?.title || site.brand.appName,
      description: footer.brand?.description || '',
      url: localizeUrl(brand?.url || '/', locale),
      logo: brand?.logo
        ? {
            src: brand.logo.src,
            alt: brand.logo.alt || brand?.title || site.brand.appName,
          }
        : undefined,
    },
    header: {
      navItems: toShellNavItems(headerNavItems, locale),
      buttonItems: toShellNavItems(headerButtonItems, locale),
      userNavItems: [],
      showSign: Boolean(header.show_sign),
      signInHref: localizeUrl('/sign-in', locale),
      signInLabel: getSignInLabel(locale),
      ariaLabel: site.brand.appName,
    },
    footer: {
      groups: toFooterGroups(footerNavItems, locale),
      agreementItems: toShellNavItems(agreementItems, locale),
      copyright: footer.copyright || `© ${site.brand.appName}`,
      ariaLabel: site.brand.appName,
    },
  };
}

function filterTanStackShellNavItems(items: readonly NavItem[]): NavItem[] {
  const filteredItems: NavItem[] = [];

  for (const item of items) {
    const children = item.children?.length
      ? filterTanStackShellNavItems(item.children)
      : [];
    const url = item.url?.trim() ?? '';
    const hasVisibleUrl = Boolean(url) && !isUnavailableTanStackShellUrl(url);
    const hasVisibleChildren = children.length > 0;

    if (!hasVisibleUrl && !hasVisibleChildren) {
      continue;
    }

    const nextItem: NavItem = {
      ...item,
      url: hasVisibleUrl ? url : '',
    };

    if (hasVisibleChildren) {
      nextItem.children = children;
    } else {
      delete nextItem.children;
    }

    filteredItems.push(nextItem);
  }

  return filteredItems;
}

function isUnavailableTanStackShellUrl(url: string) {
  const normalizedUrl =
    url.length > 1 && url.endsWith('/') ? url.slice(0, -1) : url;

  return (
    normalizedUrl === '/docs' ||
    normalizedUrl.startsWith('/docs/') ||
    normalizedUrl === '/my-images' ||
    normalizedUrl.startsWith('/my-images/')
  );
}

function buildFallbackShellData(locale: string): SlugShellData {
  const privacyTitle = getPageTitle('privacy-policy', locale);
  const termsTitle = getPageTitle('terms-of-service', locale);
  const pricingTitle = getPricingTitle(locale);
  const pricingItems = pricingTitle
    ? [{ title: pricingTitle, url: localizeUrl('/pricing', locale) }]
    : [];

  return {
    publicUiConfig: toSerializablePublicUiConfig(buildPublicUiConfig()),
    authSettings: buildAuthSettings(),
    billingSettings: buildBillingSettings(),
    brand: {
      title: site.brand.appName,
      url: localizeUrl('/', locale),
      logo: site.brand.logo
        ? { src: site.brand.logo, alt: site.brand.appName }
        : undefined,
    },
    header: {
      navItems: pricingItems,
      buttonItems: [],
      userNavItems: [],
      showSign: Boolean(site.capabilities.auth),
      signInHref: localizeUrl('/sign-in', locale),
      signInLabel: getSignInLabel(locale),
      ariaLabel: site.brand.appName,
    },
    footer: {
      groups: [
        {
          title: site.brand.appName,
          items: [
            {
              title: privacyTitle,
              url: localizeUrl('/privacy-policy', locale),
            },
            {
              title: termsTitle,
              url: localizeUrl('/terms-of-service', locale),
            },
          ],
        },
      ],
      agreementItems: [
        { title: privacyTitle, url: localizeUrl('/privacy-policy', locale) },
        { title: termsTitle, url: localizeUrl('/terms-of-service', locale) },
      ],
      copyright: `© ${site.brand.appName}`,
      ariaLabel: site.brand.appName,
    },
  };
}

function toFooterGroups(items: readonly NavItem[], locale: string) {
  return items
    .map((item) => ({
      title: getNavTitle(item),
      items: toShellNavItems(item.children ?? [], locale),
    }))
    .filter((group) => group.title || group.items.length > 0);
}

function toShellNavItems(
  items: readonly NavItem[],
  locale: string
): SlugShellNavItem[] {
  return items
    .map((item) => toShellNavItem(item, locale))
    .filter((item): item is SlugShellNavItem => Boolean(item));
}

function toShellNavItem(
  item: NavItem,
  locale: string
): SlugShellNavItem | null {
  const children = toShellNavItems(item.children ?? [], locale);
  const title = getNavTitle(item);

  if (!title && children.length === 0) {
    return null;
  }

  return {
    title,
    url: item.url ? localizeUrl(item.url, locale) : undefined,
    target: item.target,
    children,
  };
}

function getNavTitle(item: NavItem) {
  return item.title || item.name || item.text || '';
}

function getPageTitle(slug: string, locale: string) {
  const page = getLocalPublicContentDocument({
    collection: 'pages',
    slug,
    locale,
  });

  return page?.title || slug;
}

function getPricingTitle(locale: string) {
  const localizedPricing = (siteLocalizedPricing as SiteLocalizedPricing)[
    locale
  ];
  return localizedPricing?.pricing.title || sitePricing?.pricing.title || '';
}

function getSignInLabel(locale: string) {
  const messages = commonMessagesByLocale[locale] ?? commonMessagesByLocale.en;
  return messages.sign?.sign_in_title || 'Sign In';
}

function localizeUrl(url: string, locale: string) {
  if (
    !url ||
    url.startsWith('#') ||
    url.startsWith('http://') ||
    url.startsWith('https://') ||
    url.startsWith('mailto:') ||
    url.startsWith('tel:')
  ) {
    return url;
  }

  if (!url.startsWith('/') || locale === defaultLocale) {
    return url;
  }

  if (url === `/${locale}` || url.startsWith(`/${locale}/`)) {
    return url;
  }

  return url === '/' ? `/${locale}` : `/${locale}${url}`;
}

function toSerializablePublicUiConfig(
  config: PublicUiConfig
): SerializablePublicUiConfig {
  return {
    ...config,
    socialLinks: toSerializablePublicUiNavItems(config.socialLinks),
  };
}

function toSerializablePublicUiNavItems(
  items: readonly NavItem[]
): SerializablePublicUiNavItem[] {
  return items.map((item) => {
    const { icon, children, ...rest } = item;
    return {
      ...rest,
      ...(typeof icon === 'string' ? { icon } : {}),
      ...(children?.length
        ? { children: toSerializablePublicUiNavItems(children) }
        : {}),
    };
  });
}

function buildPublicUiConfig(): PublicUiConfig {
  return {
    aiEnabled: Boolean(site.capabilities.ai),
    localeSwitcherEnabled: false,
    socialLinksEnabled: false,
    socialLinksJson: '',
    socialLinks: [],
    affiliate: {
      affonsoEnabled: false,
      promotekitEnabled: false,
    },
  };
}

function buildAuthSettings(): AuthUiRuntimeSettings {
  return {
    emailAuthEnabled: Boolean(site.capabilities.auth),
    googleAuthEnabled: false,
    googleOneTapEnabled: false,
    googleClientId: '',
    githubAuthEnabled: false,
  };
}

function buildBillingSettings(): BillingRuntimeSettings {
  const shared = {
    locale: '',
    defaultLocale,
  } as const;

  const paymentCapability = site.capabilities.payment as
    | 'none'
    | 'stripe'
    | 'creem'
    | 'paypal';

  switch (paymentCapability) {
    case 'stripe':
      return {
        ...shared,
        provider: 'stripe',
        paymentCapability: 'stripe',
        stripePaymentMethods: '',
      };
    case 'creem':
      return {
        ...shared,
        provider: 'creem',
        paymentCapability: 'creem',
        creemEnvironment: 'sandbox',
        creemProductIds: '',
      };
    case 'paypal':
      return {
        ...shared,
        provider: 'paypal',
        paymentCapability: 'paypal',
        paypalEnvironment: 'sandbox',
      };
    case 'none':
      return {
        ...shared,
        provider: 'none',
        paymentCapability: 'none',
      };
  }
}
