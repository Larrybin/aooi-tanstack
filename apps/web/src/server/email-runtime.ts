import { buildEmailRuntimeSettings } from '@/domains/settings/application/settings-runtime.builders';
import type {
  EmailRuntimeBindings,
  EmailRuntimeSettings,
} from '@/domains/settings/application/settings-runtime.contracts';
import {
  createEmailService,
  type EmailService,
} from '@/infra/adapters/email/service-builder';
import { getRuntimeEnvString } from '@/infra/runtime/env.server';

import {
  readTanStackSettingsCached,
  readTanStackSettingsFresh,
  type ReadTanStackSettingsCachedDeps,
} from './billing-runtime';
import { readTanStackCloudflareBindings } from './cloudflare-bindings';

type ReadTanStackEmailRuntimeDeps = ReadTanStackSettingsCachedDeps;
type GetRandomValues = <T extends ArrayBufferView | null>(array: T) => T;

const UINT32_RANGE = 0x1_0000_0000;

export async function readTanStackEmailRuntimeSettingsFresh(
  deps: ReadTanStackEmailRuntimeDeps = {}
): Promise<EmailRuntimeSettings> {
  return buildEmailRuntimeSettings(await readTanStackSettingsFresh(deps));
}

export async function readTanStackEmailRuntimeSettingsCached(
  deps: ReadTanStackEmailRuntimeDeps = {}
): Promise<EmailRuntimeSettings> {
  return buildEmailRuntimeSettings(
    await readTanStackSettingsCached({
      ...deps,
      cacheKey: deps.cacheKey ?? 'email-runtime',
    })
  );
}

export async function readTanStackEmailRuntimeSettings(
  deps: ReadTanStackEmailRuntimeDeps = {}
): Promise<EmailRuntimeSettings> {
  return readTanStackEmailRuntimeSettingsCached(deps);
}

export async function readTanStackEmailRuntimeBindings(
  deps: Pick<ReadTanStackEmailRuntimeDeps, 'getTanStackCloudflareBindings'> = {}
): Promise<EmailRuntimeBindings> {
  const bindings = await (
    deps.getTanStackCloudflareBindings ?? readTanStackCloudflareBindings
  )();

  return {
    resendApiKey:
      getRuntimeEnvString('RESEND_' + 'API_KEY', { bindings })?.trim() || '',
  };
}

export async function createTanStackEmailService(): Promise<EmailService> {
  const [settings, bindings] = await Promise.all([
    readTanStackEmailRuntimeSettings(),
    readTanStackEmailRuntimeBindings(),
  ]);

  return createEmailService({ settings, bindings });
}

export function createRuntimeRandomInt(
  min: number,
  max: number,
  getRandomValues: GetRandomValues = crypto.getRandomValues.bind(crypto)
): number {
  const range = max - min;
  if (
    !Number.isInteger(min) ||
    !Number.isInteger(max) ||
    range <= 0 ||
    range > UINT32_RANGE
  ) {
    throw new RangeError('invalid randomInt range');
  }

  const value = new Uint32Array(1);
  const limit = UINT32_RANGE - (UINT32_RANGE % range);
  do {
    getRandomValues(value);
  } while (value[0] >= limit);

  return min + (value[0] % range);
}
