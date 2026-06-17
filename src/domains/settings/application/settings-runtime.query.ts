import { getRuntimeEnvString } from '@/infra/runtime/env.server';

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
import { readSettingsCached, readSettingsFresh } from './settings-store';

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

export async function readPublicUiConfigCached(): Promise<PublicUiConfig> {
  return buildPublicUiConfig(await readSettingsCached());
}

export async function readPublicUiConfigFresh(): Promise<PublicUiConfig> {
  return buildPublicUiConfig(await readSettingsFresh());
}

export async function readAuthUiRuntimeSettingsCached(): Promise<AuthUiRuntimeSettings> {
  return buildAuthUiRuntimeSettings(
    await readSettingsCached(),
    readAuthServerBindingsFromRuntime()
  );
}

export async function readAuthUiRuntimeSettingsFresh(): Promise<AuthUiRuntimeSettings> {
  return buildAuthUiRuntimeSettings(
    await readSettingsFresh(),
    readAuthServerBindingsFromRuntime()
  );
}

export async function readBillingRuntimeSettingsCached(): Promise<BillingRuntimeSettings> {
  return buildBillingRuntimeSettings(await readSettingsCached());
}

export async function readBillingRuntimeSettingsFresh(): Promise<BillingRuntimeSettings> {
  return buildBillingRuntimeSettings(await readSettingsFresh());
}

export async function readAiRuntimeSettingsCached(): Promise<AiRuntimeSettings> {
  return buildAiRuntimeSettings(await readSettingsCached());
}

export async function readAiRuntimeSettingsFresh(): Promise<AiRuntimeSettings> {
  return buildAiRuntimeSettings(await readSettingsFresh());
}

export async function readEmailRuntimeSettingsCached(): Promise<EmailRuntimeSettings> {
  return buildEmailRuntimeSettings(await readSettingsCached());
}

export async function readAnalyticsRuntimeSettingsCached(): Promise<AnalyticsRuntimeSettings> {
  return buildAnalyticsRuntimeSettings(await readSettingsCached());
}

export async function readAffiliateRuntimeSettingsCached(): Promise<AffiliateRuntimeSettings> {
  return buildAffiliateRuntimeSettings(await readSettingsCached());
}

export async function readCustomerServiceRuntimeSettingsCached(): Promise<CustomerServiceRuntimeSettings> {
  return buildCustomerServiceRuntimeSettings(await readSettingsCached());
}

export async function readAdsRuntimeSettingsCached(): Promise<AdsRuntimeSettings> {
  return buildAdsRuntimeSettings(await readSettingsCached());
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
