import { buildAuthUiRuntimeSettings } from '@/domains/settings/application/settings-runtime.builders';
import type {
  AuthServerBindings,
  AuthUiRuntimeSettings,
} from '@/domains/settings/application/settings-runtime.contracts';
import {
  getRuntimeEnvString,
  type CloudflareBindings,
} from '@/infra/runtime/env.server';

import {
  readTanStackSettingsFresh,
  type ReadTanStackSettingsFreshDeps,
} from './billing-runtime';
import { readTanStackCloudflareBindings } from './cloudflare-bindings';

type ReadTanStackAuthRuntimeDeps = ReadTanStackSettingsFreshDeps;

async function resolveTanStackBindings(
  deps: Pick<ReadTanStackAuthRuntimeDeps, 'getTanStackCloudflareBindings'> = {}
): Promise<CloudflareBindings | null> {
  return await (
    deps.getTanStackCloudflareBindings ?? readTanStackCloudflareBindings
  )();
}

function readBindingString(
  name: string,
  bindings: CloudflareBindings | null
): string {
  return getRuntimeEnvString(name, { bindings })?.trim() || '';
}

export async function readTanStackAuthServerBindings(
  deps: Pick<ReadTanStackAuthRuntimeDeps, 'getTanStackCloudflareBindings'> = {}
): Promise<AuthServerBindings> {
  const bindings = await resolveTanStackBindings(deps);

  return {
    googleClientId: readBindingString('GOOGLE_CLIENT_ID', bindings),
    googleClientSecret: readBindingString('GOOGLE_CLIENT_SECRET', bindings),
    githubClientId: readBindingString('GITHUB_CLIENT_ID', bindings),
    githubClientSecret: readBindingString('GITHUB_CLIENT_SECRET', bindings),
  };
}

export async function readTanStackAuthUiRuntimeSettings(
  deps: ReadTanStackAuthRuntimeDeps = {}
): Promise<AuthUiRuntimeSettings> {
  const [configs, bindings] = await Promise.all([
    readTanStackSettingsFresh(deps),
    readTanStackAuthServerBindings(deps),
  ]);

  return buildAuthUiRuntimeSettings(configs, bindings);
}
