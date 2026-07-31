import { site } from '@/site';

import type { SiteModuleId } from './product-modules/types';

export type SiteCapabilities = {
  readonly enabledModules: readonly SiteModuleId[];
  readonly paymentProvider: 'none' | 'stripe' | 'creem' | 'paypal';
};

export function hasSiteModule(
  moduleId: SiteModuleId,
  capabilities: SiteCapabilities = site.capabilities
): boolean {
  return capabilities.enabledModules.includes(moduleId);
}
