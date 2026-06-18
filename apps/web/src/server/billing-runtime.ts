import { buildBillingRuntimeSettings } from '@/domains/settings/application/settings-runtime.builders';
import type {
  BillingRuntimeSettings,
  PaymentRuntimeBindings,
} from '@/domains/settings/application/settings-runtime.contracts';
import {
  readSettingsWithPlatformCache,
  type SettingsPlatformCache,
} from '@/domains/settings/application/settings-store';
import { db } from '@/infra/adapters/db';
import { getPaymentRuntimeBindings } from '@/infra/adapters/payment/runtime-bindings';
import { mergeAuthSpikeOAuthConfigSeedConfigs } from '@/infra/platform/auth/oauth-spike-config';
import {
  getServerRuntimeEnv,
  isCloudflareWorkersRuntime,
  type CloudflareBindings,
} from '@/infra/runtime/env.server';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import { config } from '@/config/db/schema';
import { mergeCloudflareLocalSmokeConfigSeedConfigs } from '@/shared/lib/cloudflare-local-smoke-config';

import { readTanStackCloudflareBindings } from './cloudflare-bindings';

type Configs = Record<string, string>;
type ConfigRow = typeof config.$inferSelect;
export type ReadTanStackSettingsFreshDeps = {
  getTanStackCloudflareBindings?: () => Promise<CloudflareBindings | null>;
  getRuntimeEnv?: typeof getServerRuntimeEnv;
  isWorkersRuntime?: typeof isCloudflareWorkersRuntime;
  readConfigRows?: (databaseUrl?: string) => Promise<ConfigRow[]>;
};
export type ReadTanStackSettingsCachedDeps = ReadTanStackSettingsFreshDeps & {
  settingsCache?: SettingsPlatformCache | null;
  settingsCacheSiteKey?: string;
};
type ReadTanStackPaymentRuntimeBindingsDeps = Pick<
  ReadTanStackSettingsFreshDeps,
  'getTanStackCloudflareBindings' | 'isWorkersRuntime'
>;

async function readConfigRowsWithDatabaseUrl(databaseUrl: string) {
  const client = postgres(databaseUrl, {
    prepare: false,
    max: 1,
    idle_timeout: 10,
    connect_timeout: 5,
  });

  try {
    return await drizzle(client).select().from(config);
  } finally {
    await client.end();
  }
}

async function readConfigRows(databaseUrl?: string) {
  if (databaseUrl) {
    return await readConfigRowsWithDatabaseUrl(databaseUrl);
  }

  return await db().select().from(config);
}

function mergeRuntimeSeedConfigs(configs: Configs) {
  return mergeCloudflareLocalSmokeConfigSeedConfigs(
    mergeAuthSpikeOAuthConfigSeedConfigs(configs)
  );
}

export async function readTanStackSettingsFresh(
  deps: ReadTanStackSettingsFreshDeps = {}
): Promise<Configs> {
  const configs: Configs = {};
  const isWorkersRuntime = deps.isWorkersRuntime ?? isCloudflareWorkersRuntime;
  const tanStackBindings = await (
    deps.getTanStackCloudflareBindings ?? readTanStackCloudflareBindings
  )();
  const runtimeEnv = deps.getRuntimeEnv
    ? deps.getRuntimeEnv({ bindings: tanStackBindings ?? undefined })
    : getServerRuntimeEnv({ bindings: tanStackBindings ?? undefined });

  if (!runtimeEnv.databaseUrl && !isWorkersRuntime()) {
    return mergeRuntimeSeedConfigs(configs);
  }

  const bindingDatabaseUrl =
    runtimeEnv.databaseUrl || tanStackBindings?.HYPERDRIVE?.connectionString;
  if (!bindingDatabaseUrl) {
    return mergeRuntimeSeedConfigs(configs);
  }

  const rows = await (deps.readConfigRows ?? readConfigRows)(
    tanStackBindings ? bindingDatabaseUrl : undefined
  );
  for (const row of rows) {
    configs[row.name] = row.value ?? '';
  }

  return mergeRuntimeSeedConfigs(configs);
}

export async function readTanStackSettingsCached(
  deps: ReadTanStackSettingsCachedDeps = {}
): Promise<Configs> {
  return readSettingsWithPlatformCache({
    readFresh: () => readTanStackSettingsFresh(deps),
    cache: deps.settingsCache,
    siteKey: deps.settingsCacheSiteKey,
  });
}

export async function readTanStackBillingRuntimeSettings(
  deps: ReadTanStackSettingsFreshDeps = {}
): Promise<BillingRuntimeSettings> {
  return buildBillingRuntimeSettings(await readTanStackSettingsFresh(deps));
}

export async function readTanStackPaymentRuntimeBindings(
  deps: ReadTanStackPaymentRuntimeBindingsDeps = {}
): Promise<PaymentRuntimeBindings> {
  const isWorkersRuntime = deps.isWorkersRuntime ?? isCloudflareWorkersRuntime;
  if (!isWorkersRuntime()) {
    return getPaymentRuntimeBindings();
  }

  const tanStackBindings = isWorkersRuntime()
    ? await (
        deps.getTanStackCloudflareBindings ?? readTanStackCloudflareBindings
      )()
    : null;

  return getPaymentRuntimeBindings({
    bindings: tanStackBindings,
  });
}
