import { buildBackgroundRemoverHeaderFooter } from '@/domains/background-remover/ui/background-remover-shell';
import { resolveBackgroundRemoverHomeCopy } from '@/domains/background-remover/ui/background-remover-home-copy';
import { buildMp4CompressorHeaderFooter } from '@/domains/mp4-compressor/ui/mp4-compressor-shell';
import { resolveMp4CompressorHomeCopy } from '@/domains/mp4-compressor/ui/mp4-compressor-home-copy';
import { buildRemoverHeaderFooter } from '@/domains/remover/ui/remover-shell';
import { resolveRemoverHomeCopy } from '@/domains/remover/ui/remover-home-copy';
import { getLocalPublicContentDocument } from '@/domains/content/application/public-content-manifest';
import { buildTextToSpeechGeneratorHeaderFooter } from '@/domains/text-to-speech-generator/ui/text-to-speech-shell';
import { resolveTextToSpeechGeneratorHomeCopy } from '@/domains/text-to-speech-generator/ui/text-to-speech-home-copy';
import enCommon from '@/config/locale/messages/en/common.json';
import jaCommon from '@/config/locale/messages/ja/common.json';
import zhCommon from '@/config/locale/messages/zh/common.json';
import zhTwCommon from '@/config/locale/messages/zh-TW/common.json';
import {
  site,
  siteHomeContent,
  siteLocalizedPricing,
  sitePricing,
} from '@/site';

import { defaultLocale } from '@/config/locale';
import type { NavItem } from '@/shared/types/blocks/common';
import type {
  Footer as FooterType,
  Header as HeaderType,
} from '@/shared/types/blocks/landing';
import type { SitePricing } from '@/shared/types/blocks/pricing';

import type { SlugShellData, SlugShellNavItem } from '@/surfaces/landing/slug/slug.types';

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
    return toSlugShellData(productShell, locale);
  }

  return buildFallbackShellData(locale);
}

function resolveProductHeaderFooter(locale: string): HeaderFooter | null {
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

function toSlugShellData(shell: HeaderFooter, locale: string): SlugShellData {
  const brand = shell.header.brand ?? shell.footer.brand;
  const agreementItems = shell.footer.agreement?.items ?? [];

  return {
    publicUiConfig: buildPublicUiConfig(),
    authSettings: buildAuthSettings(),
    billingSettings: buildBillingSettings(),
    brand: {
      title: brand?.title || site.brand.appName,
      description: shell.footer.brand?.description || '',
      url: localizeUrl(brand?.url || '/', locale),
      logo: brand?.logo
        ? {
            src: brand.logo.src,
            alt: brand.logo.alt || brand?.title || site.brand.appName,
          }
        : undefined,
    },
    header: {
      navItems: toShellNavItems(shell.header.nav?.items ?? [], locale),
      buttonItems: toShellNavItems(shell.header.buttons ?? [], locale),
      userNavItems: toShellNavItems(shell.header.user_nav?.items ?? [], locale),
      showSign: Boolean(shell.header.show_sign),
      signInHref: localizeUrl('/sign-in', locale),
      signInLabel: getSignInLabel(locale),
      ariaLabel: site.brand.appName,
    },
    footer: {
      groups: toFooterGroups(shell.footer.nav?.items ?? [], locale),
      agreementItems: toShellNavItems(agreementItems, locale),
      copyright: shell.footer.copyright || `© ${site.brand.appName}`,
      ariaLabel: site.brand.appName,
    },
  };
}

function buildFallbackShellData(locale: string): SlugShellData {
  const privacyTitle = getPageTitle('privacy-policy', locale);
  const termsTitle = getPageTitle('terms-of-service', locale);
  const pricingTitle = getPricingTitle(locale);
  const pricingItems = pricingTitle
    ? [{ title: pricingTitle, url: localizeUrl('/pricing', locale) }]
    : [];

  return {
    publicUiConfig: buildPublicUiConfig(),
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
            { title: privacyTitle, url: localizeUrl('/privacy-policy', locale) },
            { title: termsTitle, url: localizeUrl('/terms-of-service', locale) },
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
  const localizedPricing = (siteLocalizedPricing as SiteLocalizedPricing)[locale];
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

function buildPublicUiConfig() {
  return {
    aiEnabled: Boolean(site.capabilities.ai),
    localeSwitcherEnabled: false,
    socialLinksEnabled: false,
    socialLinksJson: '',
    socialLinks: [] as [],
    affiliate: {
      affonsoEnabled: false,
      promotekitEnabled: false,
    },
  };
}

function buildAuthSettings() {
  return {
    emailAuthEnabled: Boolean(site.capabilities.auth),
    googleAuthEnabled: false,
    googleOneTapEnabled: false,
    googleClientId: '',
    githubAuthEnabled: false,
  };
}

function buildBillingSettings() {
  const shared = {
    locale: '',
    defaultLocale,
  } as const;

  const paymentCapability = site.capabilities.payment as 'none' | 'stripe' | 'creem' | 'paypal';

  switch (paymentCapability) {
    case 'stripe':
      return {
        ...shared,
        provider: 'stripe' as const,
        paymentCapability: 'stripe' as const,
        stripePaymentMethods: '',
      };
    case 'creem':
      return {
        ...shared,
        provider: 'creem' as const,
        paymentCapability: 'creem' as const,
        creemEnvironment: 'sandbox' as const,
        creemProductIds: '',
      };
    case 'paypal':
      return {
        ...shared,
        provider: 'paypal' as const,
        paymentCapability: 'paypal' as const,
        paypalEnvironment: 'sandbox' as const,
      };
    case 'none':
      return {
        ...shared,
        provider: 'none' as const,
        paymentCapability: 'none' as const,
      };
  }
}
