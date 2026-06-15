import { buildBillingRuntimeSettings } from '@/domains/settings/application/settings-runtime.builders';
import type {
  BillingRuntimeSettings,
  PaymentRuntimeBindings,
} from '@/domains/settings/application/settings-runtime.contracts';
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
  cacheKey?: string;
  cacheTtlMs?: number;
  now?: () => number;
};
type ReadTanStackPaymentRuntimeBindingsDeps = Pick<
  ReadTanStackSettingsFreshDeps,
  'getTanStackCloudflareBindings' | 'isWorkersRuntime'
>;

const TANSTACK_SETTINGS_CACHE_TTL_MS = 60 * 1000;
const settingsCache = new Map<
  string,
  {
    expiresAt: number;
    value: Configs;
  }
>();

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
    return mergeAuthSpikeOAuthConfigSeedConfigs(configs);
  }

  const bindingDatabaseUrl =
    runtimeEnv.databaseUrl || tanStackBindings?.HYPERDRIVE?.connectionString;
  const rows = await (deps.readConfigRows ?? readConfigRows)(
    tanStackBindings ? bindingDatabaseUrl : undefined
  );
  for (const row of rows) {
    configs[row.name] = row.value ?? '';
  }

  return mergeCloudflareLocalSmokeConfigSeedConfigs(
    mergeAuthSpikeOAuthConfigSeedConfigs(configs)
  );
}

export async function readTanStackSettingsCached(
  deps: ReadTanStackSettingsCachedDeps = {}
): Promise<Configs> {
  const now = deps.now?.() ?? Date.now();
  const cacheKey = deps.cacheKey ?? 'default';
  const cached = settingsCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return structuredClone(cached.value);
  }

  const value = await readTanStackSettingsFresh(deps);
  settingsCache.set(cacheKey, {
    expiresAt: now + (deps.cacheTtlMs ?? TANSTACK_SETTINGS_CACHE_TTL_MS),
    value: structuredClone(value),
  });

  return structuredClone(value);
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
