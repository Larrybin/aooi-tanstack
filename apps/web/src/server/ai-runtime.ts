import { buildAiRuntimeSettings } from '@/domains/settings/application/settings-runtime.builders';
import type {
  AiProviderBindings,
  AiRuntimeSettings,
} from '@/domains/settings/application/settings-runtime.contracts';
import { getRuntimeEnvString } from '@/infra/runtime/env.server';

import type { ConfigConsistencyMode } from '@/shared/lib/config-consistency';

import {
  readTanStackSettingsCached,
  readTanStackSettingsFresh,
  type ReadTanStackSettingsCachedDeps,
} from './billing-runtime';
import { readTanStackCloudflareBindings } from './cloudflare-bindings';

type ReadTanStackAiRuntimeDeps = ReadTanStackSettingsCachedDeps;

export async function readTanStackAiRuntimeSettingsCached(
  deps: ReadTanStackAiRuntimeDeps = {}
): Promise<AiRuntimeSettings> {
  return buildAiRuntimeSettings(
    await readTanStackSettingsCached({
      ...deps,
      cacheKey: deps.cacheKey ?? 'ai-runtime',
    })
  );
}

export async function readTanStackAiRuntimeSettingsFresh(
  deps: ReadTanStackAiRuntimeDeps = {}
): Promise<AiRuntimeSettings> {
  return buildAiRuntimeSettings(await readTanStackSettingsFresh(deps));
}

export async function readTanStackAiRuntimeSettings(
  mode: ConfigConsistencyMode = 'cached',
  deps: ReadTanStackAiRuntimeDeps = {}
): Promise<AiRuntimeSettings> {
  return mode === 'fresh'
    ? readTanStackAiRuntimeSettingsFresh(deps)
    : readTanStackAiRuntimeSettingsCached(deps);
}

function readBindingString(
  name: string,
  bindings: Awaited<ReturnType<typeof readTanStackCloudflareBindings>>
) {
  return getRuntimeEnvString(name, { bindings })?.trim() || '';
}

export async function readTanStackAiProviderBindings(
  deps: Pick<ReadTanStackAiRuntimeDeps, 'getTanStackCloudflareBindings'> = {}
): Promise<AiProviderBindings> {
  const bindings = await (
    deps.getTanStackCloudflareBindings ?? readTanStackCloudflareBindings
  )();

  return {
    openrouterApiKey: readBindingString('OPENROUTER_' + 'API_KEY', bindings),
    replicateApiToken: readBindingString('REPLICATE_' + 'API_TOKEN', bindings),
    falApiKey: readBindingString('FAL_' + 'API_KEY', bindings),
    kieApiKey: readBindingString('KIE_' + 'API_KEY', bindings),
  };
}
