
import {
  readAdsRuntimeSettingsCached,
  readAdsRuntimeSettingsFresh,
} from '@/domains/settings/application/settings-runtime.query';

import { isDebugEnv, isProductionEnv } from '@/shared/lib/env';

import { resolveAdsRuntime, type ResolvedAdsRuntime } from './runtime';

export {
  getAdsTxtBody,
  resolveAdsRuntime,
  type ResolvedAdsRuntime,
} from './runtime';

export function createAdsRuntime(
  settings: Awaited<ReturnType<typeof readAdsRuntimeSettingsCached>>
): ResolvedAdsRuntime {
  if (!isProductionEnv() && !isDebugEnv()) {
    return { enabled: false };
  }

  return resolveAdsRuntime(settings);
}

export async function getAdsRuntimeCached(): Promise<ResolvedAdsRuntime> {
  return createAdsRuntime(await readAdsRuntimeSettingsCached());
}

export async function getAdsRuntimeFresh(): Promise<ResolvedAdsRuntime> {
  return createAdsRuntime(await readAdsRuntimeSettingsFresh());
}
