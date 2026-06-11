import type {
  AuthUiRuntimeSettings,
  BillingRuntimeSettings,
  PublicUiConfig,
} from '@/domains/settings/application/settings-runtime.contracts';
import type { TanStackHead } from '@/shared/seo/canonical';

export type SlugPageTocItem = {
  title: string;
  url: string;
  depth: number;
};

export type SlugPageData = {
  id: string;
  slug: string;
  title: string;
  description: string;
  content: string;
  createdAt: string;
  toc: SlugPageTocItem[];
};

export type SlugShellNavItem = {
  title: string;
  url?: string;
  target?: string;
  children?: SlugShellNavItem[];
};

type SlugPublicUiConfig = Omit<PublicUiConfig, 'socialLinks'> & {
  socialLinks: [];
};

export type SlugShellData = {
  publicUiConfig: SlugPublicUiConfig;
  authSettings: AuthUiRuntimeSettings;
  billingSettings: BillingRuntimeSettings;
  brand: {
    title: string;
    description?: string;
    url?: string;
    logo?: {
      src: string;
      alt: string;
    };
  };
  header: {
    navItems: SlugShellNavItem[];
    buttonItems: SlugShellNavItem[];
    userNavItems: SlugShellNavItem[];
    showSign: boolean;
    signInHref: string;
    signInLabel: string;
    ariaLabel: string;
  };
  footer: {
    groups: Array<{
      title: string;
      items: SlugShellNavItem[];
    }>;
    agreementItems: SlugShellNavItem[];
    copyright: string;
    ariaLabel: string;
  };
};

export type SlugRouteData = {
  locale: string;
  slug: string;
  canonicalPath: string;
  head: TanStackHead;
  shell: SlugShellData;
  page: SlugPageData;
};
