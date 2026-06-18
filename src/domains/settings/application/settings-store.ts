import { type KnownSettingKey } from '@/domains/settings/registry';
import { db } from '@/infra/adapters/db';
import { mergeAuthSpikeOAuthConfigSeedConfigs } from '@/infra/platform/auth/oauth-spike-config';
import { createUseCaseLogger } from '@/infra/platform/logging/logger.server';
import {
  getServerRuntimeEnv,
  isCloudflareWorkersRuntime,
} from '@/infra/runtime/env.server';
import { site } from '@/site';
import { sql } from 'drizzle-orm';

import { config } from '@/config/db/schema';
import { mergeCloudflareLocalSmokeConfigSeedConfigs } from '@/shared/lib/cloudflare-local-smoke-config';

export type Config = typeof config.$inferSelect;
export type NewConfig = typeof config.$inferInsert;
export type UpdateConfig = Partial<Omit<NewConfig, 'name'>>;

export type Configs = Record<string, string>;
export type SettingsPlatformCache = {
  match: (
    request: Request
  ) => Promise<Response | undefined> | Response | undefined;
  put: (request: Request, response: Response) => Promise<void> | void;
  delete: (request: Request) => Promise<boolean> | boolean;
};
export type SettingsCacheOptions = {
  cache?: SettingsPlatformCache | null;
  siteKey?: string;
};

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
const CONFIGS_CACHE_REVALIDATE_SECONDS = 60;
const SETTINGS_CACHE_URL = 'https://aooi.local/__settings-cache/configs';

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

  await invalidateSettingsCache();

  return result;
}

export async function addConfig(newConfig: NewConfig) {
  const [result] = await db().insert(config).values(newConfig).returning();

  await invalidateSettingsCache();

  return result;
}

export async function invalidateSettingsCache(
  options: SettingsCacheOptions = {}
) {
  const cache = resolveSettingsPlatformCache(options);
  if (!cache) return;

  try {
    await cache.delete(buildSettingsCacheRequest(options.siteKey));
  } catch (error) {
    log.warn('[settings-store] settings cache invalidation failed', {
      operation: 'invalidate-settings-cache',
      error,
    });
  }
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
  return readSettingsWithPlatformCache({
    readFresh: readSettingsFresh,
  });
}

export async function readSettingsWithPlatformCache({
  readFresh,
  ...options
}: SettingsCacheOptions & {
  readFresh: () => Promise<Configs>;
}): Promise<Configs> {
  const cache = resolveSettingsPlatformCache(options);
  if (!cache) return { ...(await readFresh()) };

  const request = buildSettingsCacheRequest(options.siteKey);
  try {
    const cached = await cache.match(request);
    if (cached?.ok) {
      const configs = await cached.clone().json();
      if (isConfigs(configs)) {
        return { ...configs };
      }
    }
  } catch (error) {
    log.warn('[settings-store] settings cache read failed', {
      operation: 'read-settings-cache',
      error,
    });
  }

  const configs = await readFresh();
  try {
    await cache.put(
      request,
      new Response(JSON.stringify(configs), {
        headers: {
          'cache-control': `public, max-age=${CONFIGS_CACHE_REVALIDATE_SECONDS}`,
          'content-type': 'application/json; charset=utf-8',
        },
      })
    );
  } catch (error) {
    log.warn('[settings-store] settings cache write failed', {
      operation: 'write-settings-cache',
      error,
    });
  }

  return { ...configs };
}

function resolveSettingsPlatformCache(options: SettingsCacheOptions) {
  if ('cache' in options) {
    return options.cache ?? null;
  }

  return typeof globalThis.caches === 'undefined'
    ? null
    : (((globalThis.caches as unknown as { default?: SettingsPlatformCache })
        .default ?? null) as SettingsPlatformCache | null);
}

function buildSettingsCacheRequest(siteKey: string = site.key as string) {
  const url = new URL(SETTINGS_CACHE_URL);
  url.searchParams.set('site', siteKey);
  return new Request(url);
}

function isConfigs(value: unknown): value is Configs {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  return Object.values(value).every((item) => typeof item === 'string');
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
