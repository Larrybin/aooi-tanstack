import { buildAdsRuntimeSettings } from '@/domains/settings/application/settings-runtime.builders';
import { resolveAdsRuntime } from '@/infra/adapters/ads/runtime';

import { readTanStackSettingsFresh } from './billing-runtime';

export async function readTanStackAdsRuntimeFresh() {
  return resolveAdsRuntime(
    buildAdsRuntimeSettings(await readTanStackSettingsFresh())
  );
}
