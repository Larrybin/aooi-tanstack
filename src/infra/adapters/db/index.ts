import { createUseCaseLogger } from '@/infra/platform/logging/logger.server';
import {
  getCloudflareBindings,
  getServerRuntimeEnv,
  isCloudflareWorkersRuntime,
} from '@/infra/runtime/env.server';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import { ServiceUnavailableError } from '@/shared/lib/api/errors';

const log = createUseCaseLogger({
  domain: 'database',
  useCase: 'db-adapter',
});

type CachedDb = {
  drizzle: ReturnType<typeof drizzle>;
  client: ReturnType<typeof postgres>;
};

let dbInstance: ReturnType<typeof drizzle> | null = null;
let singletonClient: ReturnType<typeof postgres> | null = null;

const connectionCache = new Map<string, CachedDb>();

let hasLoggedEnvironment = false;

function logEnvironmentOnce(message: string) {
  if (hasLoggedEnvironment) return;
  log.info(message, { operation: 'select-runtime-connection' });
  hasLoggedEnvironment = true;
}

function getOrCreateCachedDb(
  databaseUrl: string,
  options: Parameters<typeof postgres>[1],
  cache: Map<string, CachedDb>
): ReturnType<typeof drizzle> {
  const cached = cache.get(databaseUrl);
  if (cached) {
    return cached.drizzle;
  }

  const rawClient = postgres(databaseUrl, options);
  const drizzleClient = drizzle(rawClient);
  cache.set(databaseUrl, { drizzle: drizzleClient, client: rawClient });
  return drizzleClient;
}

export function db() {
  const runtimeEnv = getServerRuntimeEnv();
  let databaseUrl = runtimeEnv.databaseUrl;

  const cloudflareEnv = getCloudflareBindings();
  const hasCloudflareWorkersEnv = cloudflareEnv !== null;
  const runningInCloudflareWorkers = isCloudflareWorkersRuntime();
  const publicUnavailableMessage = 'database temporarily unavailable';

  if (runningInCloudflareWorkers) {
    if (!hasCloudflareWorkersEnv) {
      log.error('db: detected Cloudflare Workers but bindings env missing', {
        operation: 'resolve-cloudflare-bindings',
        hint: 'enable nodejs_compat and ensure cloudflare:workers module is available',
      });
      throw new ServiceUnavailableError(
        'Detected Cloudflare Workers environment but failed to access bindings env via "cloudflare:workers". Ensure your Worker enables `nodejs_compat` and supports the `cloudflare:workers` module.',
        undefined,
        { publicMessage: publicUnavailableMessage }
      );
    }

    const hyperdriveConnectionString =
      cloudflareEnv?.HYPERDRIVE?.connectionString;

    if (!hyperdriveConnectionString) {
      log.error('db: missing Hyperdrive binding "HYPERDRIVE"', {
        operation: 'resolve-hyperdrive-binding',
        hint: 'configure [[hyperdrive]] binding = "HYPERDRIVE" in the tracked Wrangler template rendered by the current site deploy contract',
      });
      throw new ServiceUnavailableError(
        'Cloudflare Workers requires Hyperdrive binding "HYPERDRIVE" with a valid connectionString. Configure [[hyperdrive]] binding = "HYPERDRIVE" in the tracked Wrangler template used by the current site deploy contract.',
        undefined,
        { publicMessage: publicUnavailableMessage }
      );
    }

    databaseUrl = hyperdriveConnectionString;
    logEnvironmentOnce('db: using Hyperdrive connection (Cloudflare Workers)');
  }

  if (!databaseUrl) {
    throw new ServiceUnavailableError('DATABASE_URL is not set', undefined, {
      publicMessage: publicUnavailableMessage,
    });
  }

  if (runningInCloudflareWorkers) {
    return getOrCreateCachedDb(
      databaseUrl,
      {
        prepare: false,
        max: 1,
        idle_timeout: 10,
        connect_timeout: 5,
      },
      connectionCache
    );
  }

  if (runtimeEnv.dbSingletonEnabled) {
    if (dbInstance) {
      return dbInstance;
    }

    const client = postgres(databaseUrl, {
      prepare: false,
      max: 10,
      idle_timeout: 30,
      connect_timeout: 10,
    });

    dbInstance = drizzle(client);
    singletonClient = client;
    logEnvironmentOnce('db: using singleton connection pool');
    return dbInstance;
  }

  logEnvironmentOnce('db: using cached single-connection client');
  return getOrCreateCachedDb(
    databaseUrl,
    {
      prepare: false,
      max: 1,
      idle_timeout: 20,
      connect_timeout: 10,
    },
    connectionCache
  );
}

async function closeCachedClients(cache: Map<string, CachedDb>) {
  await Promise.all(
    [...cache.values()].map(async (entry) => {
      await entry.client.end();
    })
  );
  cache.clear();
}

export async function closeDb() {
  if (singletonClient) {
    await singletonClient.end();
    singletonClient = null;
    dbInstance = null;
  }

  await closeCachedClients(connectionCache);
}
