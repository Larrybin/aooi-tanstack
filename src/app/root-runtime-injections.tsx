import type { ReactNode } from 'react';
import type {
  AdsRuntimeSettings,
  AffiliateRuntimeSettings,
  AnalyticsRuntimeSettings,
  CustomerServiceRuntimeSettings,
} from '@/domains/settings/application/settings-runtime.contracts';
import type { ResolvedAdsRuntime } from '@/infra/adapters/ads/runtime';

type RuntimeScriptProvider = {
  getMetaTags(): ReactNode;
  getHeadScripts(): ReactNode;
  getBodyScripts(): ReactNode;
};

export type RootRuntimeInjections = {
  adsMetaTags: ReactNode;
  adsHeadScripts: ReactNode;
  adsBodyScripts: ReactNode;
  analyticsMetaTags: ReactNode;
  analyticsHeadScripts: ReactNode;
  analyticsBodyScripts: ReactNode;
  affiliateMetaTags: ReactNode;
  affiliateHeadScripts: ReactNode;
  affiliateBodyScripts: ReactNode;
  customerServiceMetaTags: ReactNode;
  customerServiceHeadScripts: ReactNode;
  customerServiceBodyScripts: ReactNode;
};

export type RootRuntimeInjectionDeps = {
  isProductionEnv: () => boolean;
  isDebugEnv: () => boolean;
  shouldReadRuntimeSettings?: () => boolean;
  readAdsRuntimeSettingsCached: () => Promise<AdsRuntimeSettings>;
  readAnalyticsRuntimeSettingsCached: () => Promise<AnalyticsRuntimeSettings>;
  readAffiliateRuntimeSettingsCached: () => Promise<AffiliateRuntimeSettings>;
  readCustomerServiceRuntimeSettingsCached: () => Promise<CustomerServiceRuntimeSettings>;
  createAdsRuntime: (settings: AdsRuntimeSettings) => ResolvedAdsRuntime;
  createAnalyticsManager: (
    settings: AnalyticsRuntimeSettings
  ) => RuntimeScriptProvider;
  createAffiliateManager: (
    settings: AffiliateRuntimeSettings
  ) => RuntimeScriptProvider;
  createCustomerServiceManager: (
    settings: CustomerServiceRuntimeSettings
  ) => RuntimeScriptProvider;
};

const emptyRootRuntimeInjections: RootRuntimeInjections = {
  adsMetaTags: null,
  adsHeadScripts: null,
  adsBodyScripts: null,
  analyticsMetaTags: null,
  analyticsHeadScripts: null,
  analyticsBodyScripts: null,
  affiliateMetaTags: null,
  affiliateHeadScripts: null,
  affiliateBodyScripts: null,
  customerServiceMetaTags: null,
  customerServiceHeadScripts: null,
  customerServiceBodyScripts: null,
};

function shouldReadRuntimeSettings(deps: RootRuntimeInjectionDeps): boolean {
  return deps.shouldReadRuntimeSettings
    ? deps.shouldReadRuntimeSettings()
    : true;
}

export async function resolveRootRuntimeInjections(
  deps: RootRuntimeInjectionDeps
): Promise<RootRuntimeInjections> {
  if (
    (!deps.isProductionEnv() && !deps.isDebugEnv()) ||
    !shouldReadRuntimeSettings(deps)
  ) {
    return { ...emptyRootRuntimeInjections };
  }

  const [
    adsSettings,
    analyticsSettings,
    affiliateSettings,
    customerServiceSettings,
  ] = await Promise.all([
    deps.readAdsRuntimeSettingsCached(),
    deps.readAnalyticsRuntimeSettingsCached(),
    deps.readAffiliateRuntimeSettingsCached(),
    deps.readCustomerServiceRuntimeSettingsCached(),
  ]);

  const result = { ...emptyRootRuntimeInjections };

  const adsRuntime = deps.createAdsRuntime(adsSettings);
  if (adsRuntime.enabled) {
    result.adsMetaTags = adsRuntime.provider.getMetaTags();
    result.adsHeadScripts = adsRuntime.provider.getHeadScripts();
    result.adsBodyScripts = adsRuntime.provider.getBodyScripts();
  }

  const analyticsService = deps.createAnalyticsManager(analyticsSettings);
  result.analyticsMetaTags = analyticsService.getMetaTags();
  result.analyticsHeadScripts = analyticsService.getHeadScripts();
  result.analyticsBodyScripts = analyticsService.getBodyScripts();

  const affiliateService = deps.createAffiliateManager(affiliateSettings);
  result.affiliateMetaTags = affiliateService.getMetaTags();
  result.affiliateHeadScripts = affiliateService.getHeadScripts();
  result.affiliateBodyScripts = affiliateService.getBodyScripts();

  const customerService = deps.createCustomerServiceManager(
    customerServiceSettings
  );
  result.customerServiceMetaTags = customerService.getMetaTags();
  result.customerServiceHeadScripts = customerService.getHeadScripts();
  result.customerServiceBodyScripts = customerService.getBodyScripts();

  return result;
}
