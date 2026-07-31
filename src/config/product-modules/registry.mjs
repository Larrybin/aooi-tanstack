export const PRODUCT_MODULE_IDS = /** @type {const} */ ([
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
]);

export const SITE_MODULE_IDS = /** @type {const} */ (
  PRODUCT_MODULE_IDS.filter(
    (moduleId) => moduleId !== 'core_shell' && moduleId !== 'deploy_contract'
  )
);
