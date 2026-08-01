export const PRODUCT_MODULE_IDS = [
  'core_shell',
  'auth',
  'billing',
  'admin_settings',
  'deploy_contract',
  'docs',
  'blog',
  'ai',
  'storage',
  'analytics',
  'affiliate',
  'customer_service',
  'ads',
] as const;

export type ProductModuleIdValue = (typeof PRODUCT_MODULE_IDS)[number];
export type SiteModuleIdValue = Exclude<
  ProductModuleIdValue,
  'core_shell' | 'deploy_contract'
>;

export const SITE_MODULE_IDS: readonly SiteModuleIdValue[] =
  PRODUCT_MODULE_IDS.filter(
    (moduleId): moduleId is SiteModuleIdValue =>
      moduleId !== 'core_shell' && moduleId !== 'deploy_contract'
  );
