import 'server-only';

import {
  readAdsRuntimeSettingsCached,
  readAffiliateRuntimeSettingsCached,
  readAnalyticsRuntimeSettingsCached,
  readCustomerServiceRuntimeSettingsCached,
} from '@/domains/settings/application/settings-runtime.query';
import { createAdsRuntime } from '@/infra/adapters/ads/service';
import { createAffiliateManager } from '@/infra/adapters/affiliate/service';
import { createAnalyticsManager } from '@/infra/adapters/analytics/service';
import { createCustomerServiceManager } from '@/infra/adapters/customer-service/service';
import { site } from '@/site';

import { isDebugEnv, isProductionEnv } from '@/shared/lib/env';

import {
  resolveRootRuntimeInjections,
  type RootRuntimeInjectionDeps,
} from './root-runtime-injections';

function shouldReadRuntimeSettings(): boolean {
  return (
    site.capabilities.auth !== false ||
    site.capabilities.payment !== 'none' ||
    site.capabilities.ai !== false ||
    site.capabilities.docs !== false ||
    site.capabilities.blog !== false
  );
}

const rootRuntimeInjectionDeps = {
  isProductionEnv,
  isDebugEnv,
  shouldReadRuntimeSettings,
  readAdsRuntimeSettingsCached,
  readAnalyticsRuntimeSettingsCached,
  readAffiliateRuntimeSettingsCached,
  readCustomerServiceRuntimeSettingsCached,
  createAdsRuntime,
  createAnalyticsManager,
  createAffiliateManager,
  createCustomerServiceManager,
} satisfies RootRuntimeInjectionDeps;

export async function resolveRootRuntimeInjectionsForServer() {
  return resolveRootRuntimeInjections(rootRuntimeInjectionDeps);
}
