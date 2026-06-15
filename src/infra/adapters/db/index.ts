
import { cache } from 'react';
import { createUseCaseLogger } from '@/infra/platform/logging/logger.server';
import {
  getCloudflareBindings,
  getServerRuntimeEnv,
  isCloudflareWorkersRuntime,
} from '@/infra/runtime/env.server';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import { ServiceUnavailableError } from '@/shared/lib/api/errors';
import { isProductionEnv } from '@/shared/lib/env';

import { assertRoleDeletedAtColumnExists } from './schema-check';

const SCHEMA_CHECK_RETRY_COOLDOWN_MS = 1000;
const log = createUseCaseLogger({
  domain: 'database',
  useCase: 'db-adapter',
});

type SchemaCheckState = {
  promise: Promise<void> | null;
  lastFailureAt: number | null;
  lastError: Error | null;
};

type CachedDb = {
  drizzle: ReturnType<typeof drizzle>;
  client: ReturnType<typeof postgres>;
};

let dbInstance: ReturnType<typeof drizzle> | null = null;
let singletonClient: ReturnType<typeof postgres> | null = null;

const schemaCheckStateByUrl = new Map<string, SchemaCheckState>();
const serverlessCache = new Map<string, CachedDb>();

let hasLoggedEnvironment = false;

function createSchemaCheckState(): SchemaCheckState {
  return {
    promise: null,
    lastError: null,
    lastFailureAt: null,
  };
}

function getOrCreateSchemaCheckPromise(
  sql: ReturnType<typeof postgres>,
  state: SchemaCheckState
) {
  if (state.promise) {
    return state.promise;
  }

  const now = Date.now();
  if (
    state.lastFailureAt &&
    now - state.lastFailureAt < SCHEMA_CHECK_RETRY_COOLDOWN_MS
  ) {
    const cooldownPromise = Promise.reject(
      state.lastError ?? new Error('database schema check cooling down')
    );
    cooldownPromise.catch(() => undefined);
    return cooldownPromise;
  }

  const promise = assertRoleDeletedAtColumnExists({
    sql,
    isProduction: isProductionEnv(),
    logger: log,
  })
    .then(() => {
      state.lastError = null;
      state.lastFailureAt = null;
    })
    .catch((error: unknown) => {
      state.lastFailureAt = Date.now();
      state.lastError =
        error instanceof Error ? error : new Error(String(error));
      state.promise = null;
      throw state.lastError;
    });

  state.promise = promise;
  state.promise.catch(() => undefined);
  return state.promise;
}

function getOrCreateSharedSchemaCheckPromise(
  sql: ReturnType<typeof postgres>,
  databaseUrl: string
) {
  const state =
    schemaCheckStateByUrl.get(databaseUrl) ?? createSchemaCheckState();
  schemaCheckStateByUrl.set(databaseUrl, state);
  return getOrCreateSchemaCheckPromise(sql, state);
}

function createRequestScopedSchemaReady(
  sql: ReturnType<typeof postgres>
): () => Promise<void> {
  const state = createSchemaCheckState();
  return () => getOrCreateSchemaCheckPromise(sql, state);
}

function createSchemaCheckedClient(
  sql: ReturnType<typeof postgres>,
  getSchemaReady: () => Promise<void>
): ReturnType<typeof postgres> {
  function waitForSchema(): Promise<void> {
    try {
      return getSchemaReady();
    } catch (error: unknown) {
      return Promise.reject(
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  function wrapQuery<T extends object>(query: T): T {
    return new Proxy(query, {
      get(target, prop, receiver) {
        const value = Reflect.get(target, prop, receiver);

        if (prop === 'then' || prop === 'catch' || prop === 'finally') {
          return typeof value === 'function'
            ? (...args: unknown[]) =>
                waitForSchema().then(() =>
                  Reflect.apply(
                    value as (...args: unknown[]) => unknown,
                    target,
                    args
                  )
                )
            : value;
        }

        if (typeof value === 'function') {
          return (...args: unknown[]) =>
            waitForSchema().then(() =>
              Reflect.apply(
                value as (...args: unknown[]) => unknown,
                target,
                args
              )
            );
        }

        return value;
      },
    });
  }

  const proxy = new Proxy(sql, {
    apply(target, thisArg, argArray) {
      const query = Reflect.apply(target, thisArg, argArray) as object;
      return wrapQuery(query);
    },
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver) as unknown;

      if (prop === 'end') {
        return typeof value === 'function'
          ? (...args: unknown[]) =>
              Reflect.apply(value, target, args) as unknown
          : value;
      }

      if (prop === 'unsafe') {
        return typeof value === 'function'
          ? (...args: unknown[]) => {
              const query = Reflect.apply(value, target, args) as object;
              return wrapQuery(query);
            }
          : value;
      }

      if (typeof value === 'function') {
        return (...args: unknown[]) =>
          waitForSchema().then(
            () => Reflect.apply(value, target, args) as unknown
          );
      }

      return value;
    },
  });

  return proxy as ReturnType<typeof postgres>;
}

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
  const checkedClient = createSchemaCheckedClient(rawClient, () =>
    getOrCreateSharedSchemaCheckPromise(rawClient, databaseUrl)
  );
  const drizzleClient = drizzle(checkedClient);
  cache.set(databaseUrl, { drizzle: drizzleClient, client: rawClient });
  return drizzleClient;
}

function createWorkersDb(
  databaseUrl: string,
  options: Parameters<typeof postgres>[1]
): ReturnType<typeof drizzle> {
  const rawClient = postgres(databaseUrl, options);
  const checkedClient = createSchemaCheckedClient(
    rawClient,
    createRequestScopedSchemaReady(rawClient)
  );
  return drizzle(checkedClient);
}

const getWorkersDbForRequest = cache(
  (
    databaseUrl: string,
    options: Parameters<typeof postgres>[1]
  ): ReturnType<typeof drizzle> => createWorkersDb(databaseUrl, options)
);

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
    return getWorkersDbForRequest(databaseUrl, {
      prepare: false,
      max: 1,
      idle_timeout: 10,
      connect_timeout: 5,
    });
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

    const checkedClient = createSchemaCheckedClient(client, () =>
      getOrCreateSharedSchemaCheckPromise(client, databaseUrl)
    );
    dbInstance = drizzle(checkedClient);
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
    serverlessCache
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

  await closeCachedClients(serverlessCache);
  schemaCheckStateByUrl.clear();
}
