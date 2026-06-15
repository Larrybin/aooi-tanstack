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
  readTanStackSettingsFresh,
  type ReadTanStackSettingsFreshDeps,
} from './billing-runtime';
import { readTanStackCloudflareBindings } from './cloudflare-bindings';

type ReadTanStackEmailRuntimeDeps = ReadTanStackSettingsFreshDeps;

export async function readTanStackEmailRuntimeSettings(
  deps: ReadTanStackEmailRuntimeDeps = {}
): Promise<EmailRuntimeSettings> {
  return buildEmailRuntimeSettings(await readTanStackSettingsFresh(deps));
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

export function createRuntimeRandomInt(min: number, max: number): number {
  const range = max - min;
  if (!Number.isInteger(min) || !Number.isInteger(max) || range <= 0) {
    throw new RangeError('invalid randomInt range');
  }

  const value = new Uint32Array(1);
  crypto.getRandomValues(value);
  return min + (value[0] % range);
}
