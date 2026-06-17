import { type KnownSettingKey } from '@/domains/settings/registry';
import { db } from '@/infra/adapters/db';
import { mergeAuthSpikeOAuthConfigSeedConfigs } from '@/infra/platform/auth/oauth-spike-config';
import { createUseCaseLogger } from '@/infra/platform/logging/logger.server';
import {
  getServerRuntimeEnv,
  isCloudflareWorkersRuntime,
} from '@/infra/runtime/env.server';
import { sql } from 'drizzle-orm';

import { config } from '@/config/db/schema';
import { mergeCloudflareLocalSmokeConfigSeedConfigs } from '@/shared/lib/cloudflare-local-smoke-config';

export type Config = typeof config.$inferSelect;
export type NewConfig = typeof config.$inferInsert;
export type UpdateConfig = Partial<Omit<NewConfig, 'name'>>;

export type Configs = Record<string, string>;

export type RuntimeConfigKey = 'theme' | 'locale' | 'default_locale';

// Known keys help avoid cross-module typos; keep in sync with env/db usage
export type KnownConfigKey = KnownSettingKey | RuntimeConfigKey;

export function getString(
  configs: Configs,
  key: KnownConfigKey,
  fallback = ''
) {
  const value = configs[key];
  return value ?? fallback;
}

export function getBool(configs: Configs, key: KnownConfigKey): boolean {
  return configs[key] === 'true';
}

const log = createUseCaseLogger({
  domain: 'settings',
  useCase: 'settings-store',
});

export async function saveSettings(configs: Record<string, string>) {
  const entries = Object.entries(configs);
  if (entries.length === 0) return [];

  const values = entries.map(([name, value]) => ({ name, value }));

  const result = await db()
    .insert(config)
    .values(values)
    .onConflictDoUpdate({
      target: config.name,
      set: { value: sql`excluded.value` },
    })
    .returning();

  invalidateSettingsCache();

  return result;
}

export async function addConfig(newConfig: NewConfig) {
  const [result] = await db().insert(config).values(newConfig).returning();

  invalidateSettingsCache();

  return result;
}

export function invalidateSettingsCache() {
  // Settings reads stay uncached so Cloudflare Worker isolates cannot serve stale config.
}

async function getConfigsFromDb(): Promise<Configs> {
  const configs: Record<string, string> = {};
  const runtimeEnv = getServerRuntimeEnv();

  if (!runtimeEnv.databaseUrl && !isCloudflareWorkersRuntime()) {
    return mergeAuthSpikeOAuthConfigSeedConfigs(configs);
  }

  const result = await db().select().from(config);

  for (const config of result) {
    configs[config.name] = config.value ?? '';
  }

  return mergeCloudflareLocalSmokeConfigSeedConfigs(
    mergeAuthSpikeOAuthConfigSeedConfigs(configs)
  );
}

export async function readSettingsFresh(): Promise<Configs> {
  const configs = await getConfigsFromDb();
  return { ...configs };
}

export async function readSettingsCached(): Promise<Configs> {
  return readSettingsFresh();
}

export async function readSettingsSafe(): Promise<{
  configs: Configs;
  error?: Error;
}> {
  try {
    const configs = await readSettingsCached();
    return { configs };
  } catch (e: unknown) {
    const error =
      e instanceof Error
        ? e
        : new Error(`readSettingsCached failed: ${String(e)}`);
    log.error('[settings-store] readSettingsCached failed', {
      operation: 'read-settings-safe',
      error,
    });
    return { configs: {}, error };
  }
}
