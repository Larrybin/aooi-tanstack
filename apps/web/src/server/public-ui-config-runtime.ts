import { buildPublicUiConfig } from '@/domains/settings/application/settings-runtime.builders';
import type { PublicUiConfig } from '@/domains/settings/application/settings-runtime.contracts';

import {
  readTanStackSettingsCached,
  readTanStackSettingsFresh,
  type ReadTanStackSettingsCachedDeps,
} from './billing-runtime';

type ReadTanStackPublicUiConfigDeps = ReadTanStackSettingsCachedDeps;

const PUBLIC_UI_CONFIG_CACHE_TTL_MS = 60 * 60 * 1000;

export async function readTanStackPublicUiConfigFresh(
  deps: ReadTanStackPublicUiConfigDeps = {}
): Promise<PublicUiConfig> {
  return buildPublicUiConfig(await readTanStackSettingsFresh(deps));
}

export async function readTanStackPublicUiConfigCached(
  deps: ReadTanStackPublicUiConfigDeps = {}
): Promise<PublicUiConfig> {
  return buildPublicUiConfig(
    await readTanStackSettingsCached({
      ...deps,
      cacheKey: deps.cacheKey ?? 'public-ui-config',
      cacheTtlMs: deps.cacheTtlMs ?? PUBLIC_UI_CONFIG_CACHE_TTL_MS,
    })
  );
}
