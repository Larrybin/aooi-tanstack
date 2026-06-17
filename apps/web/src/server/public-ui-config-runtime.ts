import { buildPublicUiConfig } from '@/domains/settings/application/settings-runtime.builders';
import type { PublicUiConfig } from '@/domains/settings/application/settings-runtime.contracts';

import {
  readTanStackSettingsCached,
  readTanStackSettingsFresh,
  type ReadTanStackSettingsCachedDeps,
} from './billing-runtime';

type ReadTanStackPublicUiConfigDeps = ReadTanStackSettingsCachedDeps;

export async function readTanStackPublicUiConfigFresh(
  deps: ReadTanStackPublicUiConfigDeps = {}
): Promise<PublicUiConfig> {
  return buildPublicUiConfig(await readTanStackSettingsFresh(deps));
}

export async function readTanStackPublicUiConfigCached(
  deps: ReadTanStackPublicUiConfigDeps = {}
): Promise<PublicUiConfig> {
  return buildPublicUiConfig(await readTanStackSettingsCached(deps));
}
