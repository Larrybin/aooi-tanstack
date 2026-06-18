import {
  Children,
  Fragment,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from 'react';
import type {
  AdsRuntimeSettings,
  AffiliateRuntimeSettings,
  AnalyticsRuntimeSettings,
  CustomerServiceRuntimeSettings,
} from '@/domains/settings/application/settings-runtime.contracts';
import {
  readAdsRuntimeSettingsCached,
  readAffiliateRuntimeSettingsCached,
  readAnalyticsRuntimeSettingsCached,
  readCustomerServiceRuntimeSettingsCached,
} from '@/domains/settings/application/settings-runtime.query';
import type { ResolvedAdsRuntime } from '@/infra/adapters/ads/runtime';
import { createAdsRuntime } from '@/infra/adapters/ads/service';
import { createAffiliateManager } from '@/infra/adapters/affiliate/service';
import { createAnalyticsManager } from '@/infra/adapters/analytics/service';
import { createCustomerServiceManager } from '@/infra/adapters/customer-service/service';
import { site } from '@/site';

import { isDebugEnv, isProductionEnv } from '@/shared/lib/env';

type RuntimeScriptProvider = {
  getMetaTags(): ReactNode;
  getHeadScripts(): ReactNode;
  getBodyScripts(): ReactNode;
};

type NativeRootAttributeValue = string | number | boolean;

export type NativeRootMeta = {
  [key: string]: NativeRootAttributeValue;
};

export type NativeRootScript = {
  [key: string]: NativeRootAttributeValue | undefined;
  children?: string;
};

export type NativeRootRuntimeInjections = {
  meta: NativeRootMeta[];
  headScripts: NativeRootScript[];
  bodyScripts: NativeRootScript[];
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

type RuntimeSettingCapabilities = {
  auth: boolean;
  payment: string;
  ai: boolean;
  docs: boolean;
  blog: boolean;
};

function shouldReadRuntimeSettingsForSite(): boolean {
  const capabilities: RuntimeSettingCapabilities = site.capabilities;

  return (
    capabilities.auth ||
    capabilities.payment !== 'none' ||
    capabilities.ai ||
    capabilities.docs ||
    capabilities.blog
  );
}

function shouldReadRuntimeSettings(deps: RootRuntimeInjectionDeps): boolean {
  return deps.shouldReadRuntimeSettings
    ? deps.shouldReadRuntimeSettings()
    : true;
}

function cloneEmptyInjections(): NativeRootRuntimeInjections {
  return {
    meta: [],
    headScripts: [],
    bodyScripts: [],
  };
}

function isSerializableAttribute(value: unknown) {
  return (
    value !== undefined &&
    value !== null &&
    (typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean')
  );
}

function collectElements(
  node: ReactNode,
  tagName: 'meta' | 'script'
): Array<ReactElement<Record<string, unknown>>> {
  const elements: Array<ReactElement<Record<string, unknown>>> = [];

  Children.forEach(node, (child) => {
    if (!isValidElement(child)) return;

    if (child.type === Fragment) {
      collectElements(
        (child.props as { children?: ReactNode }).children,
        tagName
      ).forEach((element) => elements.push(element));
      return;
    }

    if (child.type === tagName) {
      elements.push(child as ReactElement<Record<string, unknown>>);
    }
  });

  return elements;
}

function getInlineScriptChildren(props: Record<string, unknown>) {
  const dangerouslySetInnerHTML = props.dangerouslySetInnerHTML;
  if (
    dangerouslySetInnerHTML &&
    typeof dangerouslySetInnerHTML === 'object' &&
    '__html' in dangerouslySetInnerHTML &&
    typeof dangerouslySetInnerHTML.__html === 'string'
  ) {
    return dangerouslySetInnerHTML.__html;
  }

  return typeof props.children === 'string' ? props.children : undefined;
}

function propsToMetaDescriptor(element: ReactElement<Record<string, unknown>>) {
  const meta: NativeRootMeta = {};

  for (const [key, value] of Object.entries(element.props)) {
    if (
      key === 'children' ||
      key === 'dangerouslySetInnerHTML' ||
      !isSerializableAttribute(value)
    ) {
      continue;
    }

    meta[key] = value;
  }

  return meta;
}

function propsToScriptDescriptor(
  element: ReactElement<Record<string, unknown>>
): NativeRootScript {
  const script: NativeRootScript = {};
  const children = getInlineScriptChildren(element.props);

  for (const [key, value] of Object.entries(element.props)) {
    if (
      key === 'children' ||
      key === 'dangerouslySetInnerHTML' ||
      !isSerializableAttribute(value)
    ) {
      continue;
    }

    script[key] = value;
  }

  if (children !== undefined) {
    script.children = children;
  }

  return script as NativeRootScript;
}

function collectMetaTags(node: ReactNode) {
  return collectElements(node, 'meta').map(propsToMetaDescriptor);
}

function collectScripts(node: ReactNode) {
  return collectElements(node, 'script').map(propsToScriptDescriptor);
}

function appendProviderInjections(
  result: NativeRootRuntimeInjections,
  provider: RuntimeScriptProvider
) {
  result.meta.push(...collectMetaTags(provider.getMetaTags()));
  result.headScripts.push(...collectScripts(provider.getHeadScripts()));
  result.bodyScripts.push(...collectScripts(provider.getBodyScripts()));
}

export async function resolveRootRuntimeInjections(
  deps: RootRuntimeInjectionDeps
): Promise<NativeRootRuntimeInjections> {
  if (
    (!deps.isProductionEnv() && !deps.isDebugEnv()) ||
    !shouldReadRuntimeSettings(deps)
  ) {
    return cloneEmptyInjections();
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

  const result = cloneEmptyInjections();
  const adsRuntime = deps.createAdsRuntime(adsSettings);
  if (adsRuntime.enabled) {
    appendProviderInjections(result, adsRuntime.provider);
  }

  appendProviderInjections(
    result,
    deps.createAnalyticsManager(analyticsSettings)
  );
  appendProviderInjections(
    result,
    deps.createAffiliateManager(affiliateSettings)
  );
  appendProviderInjections(
    result,
    deps.createCustomerServiceManager(customerServiceSettings)
  );

  return result;
}

const rootRuntimeInjectionDeps = {
  isProductionEnv,
  isDebugEnv,
  shouldReadRuntimeSettings: shouldReadRuntimeSettingsForSite,
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
