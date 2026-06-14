import { buildAiRuntimeSettings } from '@/domains/settings/application/settings-runtime.builders';
import type {
  AiProviderBindings,
  AiRuntimeSettings,
} from '@/domains/settings/application/settings-runtime.contracts';
import { getRuntimeEnvString } from '@/infra/runtime/env.server';

import {
  readTanStackSettingsFresh,
  type ReadTanStackSettingsFreshDeps,
} from './billing-runtime';
import { readTanStackCloudflareBindings } from './cloudflare-bindings';

type ReadTanStackAiRuntimeDeps = ReadTanStackSettingsFreshDeps;

export async function readTanStackAiRuntimeSettings(
  deps: ReadTanStackAiRuntimeDeps = {}
): Promise<AiRuntimeSettings> {
  return buildAiRuntimeSettings(await readTanStackSettingsFresh(deps));
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
