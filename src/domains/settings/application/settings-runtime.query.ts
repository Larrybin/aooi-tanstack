import 'server-only';

import { getRuntimeEnvString } from '@/infra/runtime/env.server';

import { unstable_cache } from '@/shared/lib/next-cache';

import {
  buildAdsRuntimeSettings,
  buildAffiliateRuntimeSettings,
  buildAiRuntimeSettings,
  buildAnalyticsRuntimeSettings,
  buildAuthUiRuntimeSettings,
  buildBillingRuntimeSettings,
  buildCustomerServiceRuntimeSettings,
  buildEmailRuntimeSettings,
  buildPublicUiConfig,
} from './settings-runtime.builders';
import type {
  AdsRuntimeSettings,
  AffiliateRuntimeSettings,
  AiRuntimeSettings,
  AnalyticsRuntimeSettings,
  AuthServerBindings,
  AuthUiRuntimeSettings,
  BillingRuntimeSettings,
  CustomerServiceRuntimeSettings,
  EmailRuntimeBindings,
  EmailRuntimeSettings,
  PublicUiConfig,
} from './settings-runtime.contracts';
import {
  CONFIGS_CACHE_TAG,
  PUBLIC_CONFIGS_CACHE_TAG,
  readSettingsCached,
  readSettingsFresh,
} from './settings-store';

function readAuthServerBindingsFromRuntime(): AuthServerBindings {
  return {
    googleClientId: getRuntimeEnvString('GOOGLE_CLIENT_ID')?.trim() || '',
    googleClientSecret:
      getRuntimeEnvString('GOOGLE_CLIENT_SECRET')?.trim() || '',
    githubClientId: getRuntimeEnvString('GITHUB_CLIENT_ID')?.trim() || '',
    githubClientSecret:
      getRuntimeEnvString('GITHUB_CLIENT_SECRET')?.trim() || '',
  };
}

const PUBLIC_UI_CONFIG_CACHE_REVALIDATE_SECONDS = 60 * 60;

const readPublicUiConfigCachedValue = unstable_cache(
  async (): Promise<PublicUiConfig> =>
    buildPublicUiConfig(await readSettingsCached()),
  [PUBLIC_CONFIGS_CACHE_TAG],
  {
    tags: [PUBLIC_CONFIGS_CACHE_TAG],
    revalidate: PUBLIC_UI_CONFIG_CACHE_REVALIDATE_SECONDS,
  }
);

const readAuthUiRuntimeSettingsCachedValue = unstable_cache(
  async (): Promise<AuthUiRuntimeSettings> =>
    buildAuthUiRuntimeSettings(
      await readSettingsCached(),
      readAuthServerBindingsFromRuntime()
    ),
  [`${CONFIGS_CACHE_TAG}:auth-runtime`],
  {
    tags: [CONFIGS_CACHE_TAG],
  }
);

const readBillingRuntimeSettingsCachedValue = unstable_cache(
  async (): Promise<BillingRuntimeSettings> =>
    buildBillingRuntimeSettings(await readSettingsCached()),
  [`${CONFIGS_CACHE_TAG}:billing-runtime`],
  {
    tags: [CONFIGS_CACHE_TAG],
  }
);

const readAiRuntimeSettingsCachedValue = unstable_cache(
  async (): Promise<AiRuntimeSettings> =>
    buildAiRuntimeSettings(await readSettingsCached()),
  [`${CONFIGS_CACHE_TAG}:ai-runtime`],
  {
    tags: [CONFIGS_CACHE_TAG],
  }
);

const readEmailRuntimeSettingsCachedValue = unstable_cache(
  async (): Promise<EmailRuntimeSettings> =>
    buildEmailRuntimeSettings(await readSettingsCached()),
  [`${CONFIGS_CACHE_TAG}:email-runtime`],
  {
    tags: [CONFIGS_CACHE_TAG],
  }
);

const readAnalyticsRuntimeSettingsCachedValue = unstable_cache(
  async (): Promise<AnalyticsRuntimeSettings> =>
    buildAnalyticsRuntimeSettings(await readSettingsCached()),
  [`${CONFIGS_CACHE_TAG}:analytics-runtime`],
  {
    tags: [CONFIGS_CACHE_TAG],
  }
);

const readAffiliateRuntimeSettingsCachedValue = unstable_cache(
  async (): Promise<AffiliateRuntimeSettings> =>
    buildAffiliateRuntimeSettings(await readSettingsCached()),
  [`${CONFIGS_CACHE_TAG}:affiliate-runtime`],
  {
    tags: [CONFIGS_CACHE_TAG],
  }
);

const readCustomerServiceRuntimeSettingsCachedValue = unstable_cache(
  async (): Promise<CustomerServiceRuntimeSettings> =>
    buildCustomerServiceRuntimeSettings(await readSettingsCached()),
  [`${CONFIGS_CACHE_TAG}:customer-service-runtime`],
  {
    tags: [CONFIGS_CACHE_TAG],
  }
);

const readAdsRuntimeSettingsCachedValue = unstable_cache(
  async (): Promise<AdsRuntimeSettings> =>
    buildAdsRuntimeSettings(await readSettingsCached()),
  [`${CONFIGS_CACHE_TAG}:ads-runtime`],
  {
    tags: [CONFIGS_CACHE_TAG],
  }
);

export async function readPublicUiConfigCached(): Promise<PublicUiConfig> {
  return structuredClone(await readPublicUiConfigCachedValue());
}

export async function readPublicUiConfigFresh(): Promise<PublicUiConfig> {
  return buildPublicUiConfig(await readSettingsFresh());
}

export async function readAuthUiRuntimeSettingsCached(): Promise<AuthUiRuntimeSettings> {
  return structuredClone(await readAuthUiRuntimeSettingsCachedValue());
}

export async function readAuthUiRuntimeSettingsFresh(): Promise<AuthUiRuntimeSettings> {
  return buildAuthUiRuntimeSettings(
    await readSettingsFresh(),
    readAuthServerBindingsFromRuntime()
  );
}

export async function readBillingRuntimeSettingsCached(): Promise<BillingRuntimeSettings> {
  return structuredClone(await readBillingRuntimeSettingsCachedValue());
}

export async function readBillingRuntimeSettingsFresh(): Promise<BillingRuntimeSettings> {
  return buildBillingRuntimeSettings(await readSettingsFresh());
}

export async function readAiRuntimeSettingsCached(): Promise<AiRuntimeSettings> {
  return structuredClone(await readAiRuntimeSettingsCachedValue());
}

export async function readAiRuntimeSettingsFresh(): Promise<AiRuntimeSettings> {
  return buildAiRuntimeSettings(await readSettingsFresh());
}

export async function readEmailRuntimeSettingsCached(): Promise<EmailRuntimeSettings> {
  return structuredClone(await readEmailRuntimeSettingsCachedValue());
}

export async function readAnalyticsRuntimeSettingsCached(): Promise<AnalyticsRuntimeSettings> {
  return structuredClone(await readAnalyticsRuntimeSettingsCachedValue());
}

export async function readAffiliateRuntimeSettingsCached(): Promise<AffiliateRuntimeSettings> {
  return structuredClone(await readAffiliateRuntimeSettingsCachedValue());
}

export async function readCustomerServiceRuntimeSettingsCached(): Promise<CustomerServiceRuntimeSettings> {
  return structuredClone(await readCustomerServiceRuntimeSettingsCachedValue());
}

export async function readAdsRuntimeSettingsCached(): Promise<AdsRuntimeSettings> {
  return structuredClone(await readAdsRuntimeSettingsCachedValue());
}

export async function readAdsRuntimeSettingsFresh(): Promise<AdsRuntimeSettings> {
  // ads.txt and SSR ad injection must observe the latest validated ads payload.
  return buildAdsRuntimeSettings(await readSettingsFresh());
}

export function readEmailRuntimeBindings(): EmailRuntimeBindings {
  return {
    resendApiKey: getRuntimeEnvString('RESEND_API_KEY')?.trim() || '',
  };
}
