import {
  ALL_SETTINGS,
  type KnownSettingKey,
} from '@/domains/settings/registry';
import type { SettingTabName } from '@/domains/settings/tab-names';

import { resolveSitePaymentCapability } from '@/config/payment-capability';

import type {
  ModuleGuideSlug,
  ProductModule,
  ProductModuleId,
  ProductModuleTier,
  ProductModuleVerification,
} from './types';

export type {
  ModuleGuideSlug,
  ProductModule,
  ProductModuleId,
  ProductModuleTier,
  ProductModuleVerification,
} from './types';
export {
  MODULE_GUIDE_SLUGS,
  PRODUCT_MODULE_IDS,
  PRODUCT_MODULE_TIERS,
  PRODUCT_MODULE_VERIFICATIONS,
} from './types';

const TIER_PRIORITY: Record<ProductModuleTier, number> = {
  mainline: 0,
  optional: 1,
  experimental: 2,
};

const RELATIONSHIP_PRIORITY = {
  owned: 0,
  supporting: 1,
} as const;

export type ProductModuleTabRelationship = keyof typeof RELATIONSHIP_PRIORITY;

export interface ProductModuleTabItem {
  moduleId: ProductModuleId;
  title: string;
  relationship: ProductModuleTabRelationship;
  tier: ProductModuleTier;
  verification: ProductModuleVerification;
  guideHref: string;
}

export const PRODUCT_MODULE_GUIDE_REPO_BASE_URL =
  'https://github.com/Larrybin/aooi/blob/main/docs/guides/';

const PRODUCT_MODULE_BASES: Omit<ProductModule, 'settingKeys'>[] = [
  {
    id: 'core_shell',
    title: 'Core Shell',
    tier: 'mainline',
    verification: 'verified',
    ownedTabs: ['general'],
    supportingTabs: [],
    docSlug: 'module-contract#core-shell',
    entryRoutes: ['/', '/pricing', '/sign-in', '/sign-up'],
    externalServices: [],
  },
  {
    id: 'auth',
    title: 'Auth',
    tier: 'mainline',
    verification: 'partial',
    ownedTabs: ['auth'],
    supportingTabs: ['email'],
    docSlug: 'modules/auth',
    entryRoutes: ['/sign-in', '/sign-up', '/forgot-password'],
    externalServices: ['Google OAuth', 'GitHub OAuth', 'Resend'],
  },
  {
    id: 'billing',
    title: 'Billing',
    tier: 'mainline',
    verification: 'partial',
    ownedTabs: ['payment'],
    supportingTabs: [],
    docSlug: 'modules/billing',
    entryRoutes: ['/pricing', '/api/payment/checkout', '/api/payment/notify'],
    externalServices: ['Stripe', 'Creem', 'PayPal'],
  },
  {
    id: 'admin_settings',
    title: 'Admin Settings',
    tier: 'mainline',
    verification: 'verified',
    ownedTabs: [],
    supportingTabs: [],
    docSlug: 'module-contract#admin-settings',
    entryRoutes: ['/admin/settings/general'],
    externalServices: [],
  },
  {
    id: 'deploy_contract',
    title: 'Deploy Contract',
    tier: 'mainline',
    verification: 'partial',
    ownedTabs: [],
    supportingTabs: [],
    docSlug: 'module-contract#deploy-contract',
    entryRoutes: ['/api/config/get-configs'],
    externalServices: ['Cloudflare'],
  },
  {
    id: 'docs',
    title: 'Docs',
    tier: 'optional',
    verification: 'partial',
    ownedTabs: [],
    supportingTabs: [],
    docSlug: 'modules/docs-blog',
    entryRoutes: ['/docs'],
    externalServices: [],
  },
  {
    id: 'blog',
    title: 'Blog',
    tier: 'optional',
    verification: 'partial',
    ownedTabs: [],
    supportingTabs: [],
    docSlug: 'modules/docs-blog',
    entryRoutes: ['/blog'],
    externalServices: [],
  },
  {
    id: 'ai',
    title: 'AI',
    tier: 'optional',
    verification: 'partial',
    ownedTabs: ['ai'],
    supportingTabs: [],
    docSlug: 'modules/ai',
    entryRoutes: ['/ai-chatbot', '/api/ai/notify/test-provider'],
    externalServices: ['OpenRouter', 'Replicate', 'Fal', 'Kie'],
  },
  {
    id: 'storage',
    title: 'Storage',
    tier: 'optional',
    verification: 'partial',
    ownedTabs: ['storage'],
    supportingTabs: [],
    docSlug: 'modules/storage',
    entryRoutes: ['/api/storage/upload-image'],
    externalServices: ['Cloudflare R2'],
  },
  {
    id: 'analytics',
    title: 'Analytics',
    tier: 'optional',
    verification: 'unverified',
    ownedTabs: ['analytics'],
    supportingTabs: [],
    docSlug: 'modules/growth-support',
    entryRoutes: [],
    externalServices: ['Google Analytics', 'Clarity', 'Plausible', 'OpenPanel'],
  },
  {
    id: 'affiliate',
    title: 'Affiliate',
    tier: 'optional',
    verification: 'unverified',
    ownedTabs: ['affiliate'],
    supportingTabs: [],
    docSlug: 'modules/growth-support',
    entryRoutes: [],
    externalServices: ['Affonso', 'PromoteKit'],
  },
  {
    id: 'customer_service',
    title: 'Customer Service',
    tier: 'optional',
    verification: 'unverified',
    ownedTabs: ['customer_service'],
    supportingTabs: ['email'],
    docSlug: 'modules/growth-support',
    entryRoutes: [],
    externalServices: ['Crisp', 'Tawk', 'Resend'],
  },
  {
    id: 'ads',
    title: 'Ads',
    tier: 'optional',
    verification: 'unverified',
    ownedTabs: ['ads'],
    supportingTabs: [],
    docSlug: 'modules/growth-support',
    entryRoutes: ['/ads.txt'],
    externalServices: ['Google AdSense', 'Adsterra'],
  },
];

const PRODUCT_MODULE_BASE_MAP = new Map(
  PRODUCT_MODULE_BASES.map((module) => [module.id, module] as const)
);

function createSettingKeysByModuleId() {
  const grouped = new Map<ProductModuleId, KnownSettingKey[]>();

  for (const setting of ALL_SETTINGS) {
    const productModuleMeta = PRODUCT_MODULE_BASE_MAP.get(setting.moduleId);
    if (!productModuleMeta) {
      throw new Error(
        `Unknown product module id referenced by setting "${setting.name}": ${setting.moduleId}`
      );
    }

    const settingKeys = grouped.get(setting.moduleId);
    if (settingKeys) {
      settingKeys.push(setting.name);
      continue;
    }

    grouped.set(setting.moduleId, [setting.name]);
  }

  return grouped;
}

const SETTING_KEYS_BY_MODULE_ID = createSettingKeysByModuleId();

export const PRODUCT_MODULES: ProductModule<KnownSettingKey>[] =
  PRODUCT_MODULE_BASES.map((module) => ({
    ...module,
    settingKeys: SETTING_KEYS_BY_MODULE_ID.get(module.id) ?? [],
  }));

export function getProductModulesByTier(tier: ProductModuleTier) {
  return PRODUCT_MODULES.filter((module) => module.tier === tier);
}

export function getSupportingProductModulesByTab(tab: SettingTabName) {
  return PRODUCT_MODULES.filter((module) =>
    module.supportingTabs.includes(tab)
  );
}

const PRODUCT_MODULE_ORDER = new Map(
  PRODUCT_MODULES.map((module, index) => [module.id, index] as const)
);

function createProductModuleTabItem(
  module: ProductModule<KnownSettingKey>,
  relationship: ProductModuleTabRelationship
): ProductModuleTabItem {
  return {
    moduleId: module.id,
    title: module.title,
    relationship,
    tier: module.tier,
    verification: module.verification,
    guideHref: getProductModuleGuideHref(module),
  };
}

function compareTabItemPriority(
  a: ProductModuleTabItem,
  b: ProductModuleTabItem
) {
  return (
    RELATIONSHIP_PRIORITY[a.relationship] -
      RELATIONSHIP_PRIORITY[b.relationship] ||
    TIER_PRIORITY[a.tier] - TIER_PRIORITY[b.tier] ||
    (PRODUCT_MODULE_ORDER.get(a.moduleId) ?? Number.MAX_SAFE_INTEGER) -
      (PRODUCT_MODULE_ORDER.get(b.moduleId) ?? Number.MAX_SAFE_INTEGER)
  );
}

export function getProductModuleItemsByTab(tab: SettingTabName) {
  const paymentCapability = resolveSitePaymentCapability();

  return PRODUCT_MODULES.flatMap((module) =>
    (
      [
        { relationship: 'owned', tabs: module.ownedTabs },
        { relationship: 'supporting', tabs: module.supportingTabs },
      ] as const
    )
      .filter(() => !(tab === 'payment' && paymentCapability === 'none'))
      .filter(({ tabs }) => tabs.includes(tab))
      .map(({ relationship }) =>
        createProductModuleTabItem(module, relationship)
      )
  ).sort(compareTabItemPriority);
}

export function getProductModuleGuideHref(
  moduleOrSlug: ProductModule<KnownSettingKey> | ModuleGuideSlug
) {
  const docSlug =
    typeof moduleOrSlug === 'string' ? moduleOrSlug : moduleOrSlug.docSlug;

  if (docSlug.startsWith('module-contract#')) {
    const anchor = docSlug.split('#')[1];
    return `${PRODUCT_MODULE_GUIDE_REPO_BASE_URL}module-contract.md#${anchor}`;
  }

  return `${PRODUCT_MODULE_GUIDE_REPO_BASE_URL}${docSlug}.md`;
}
