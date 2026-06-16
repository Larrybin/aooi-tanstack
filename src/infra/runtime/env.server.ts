import { AsyncLocalStorage } from 'node:async_hooks';
import { assertPostgresOnlyDatabaseProvider } from '@/infra/runtime/database-provider';

import type { EnvLike } from '@/config/env-contract';
import {
  resolvePublicEnvConfigs,
  type PublicEnvConfigs,
} from '@/config/public-env';
import { resolveServerAuthBaseUrl } from '@/config/server-auth-base-url';
import { isCloudflareWorker } from '@/shared/lib/env';

export type RuntimePlatform = 'node' | 'cloudflare-workers';

export type CloudflareAIBinding = {
  run(
    model: string,
    inputs: Record<string, unknown>,
    options?: Record<string, unknown>
  ): Promise<unknown>;
};

export type CloudflareBindings = {
  HYPERDRIVE?: {
    connectionString?: string;
  };
  AI?: CloudflareAIBinding;
  IMAGES?: ImagesBinding;
  NEXT_INC_CACHE_R2_BUCKET?: R2Bucket;
  APP_STORAGE_R2_BUCKET?: R2Bucket;
  NEXT_CACHE_DO_QUEUE?: unknown;
  NEXT_TAG_CACHE_DO_SHARDED?: unknown;
  STATEFUL_LIMITERS?: unknown;
  NEXT_PUBLIC_TURNSTILE_SITE_KEY?: string;
  PUBLIC_WEB_WORKER?: Fetcher;
  AUTH_WORKER?: Fetcher;
  PAYMENT_WORKER?: Fetcher;
  MEMBER_WORKER?: Fetcher;
  CHAT_WORKER?: Fetcher;
  ADMIN_WORKER?: Fetcher;
  APP_ENVIRONMENT?: string;
  INTERNAL_ENTITLEMENT_GRANTS_ENABLED?: string;
  BETTER_AUTH_SECRET?: string;
  AUTH_SECRET?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  STRIPE_PUBLISHABLE_KEY?: string;
  STRIPE_SECRET_KEY?: string;
  STRIPE_SIGNING_SECRET?: string;
  CREEM_API_KEY?: string;
  CREEM_SIGNING_SECRET?: string;
  PAYPAL_CLIENT_ID?: string;
  PAYPAL_CLIENT_SECRET?: string;
  PAYPAL_WEBHOOK_ID?: string;
  OPENROUTER_API_KEY?: string;
  REPLICATE_API_TOKEN?: string;
  FAL_API_KEY?: string;
  KIE_API_KEY?: string;
  AI_NOTIFY_WEBHOOK_SECRET?: string;
  STORAGE_PUBLIC_BASE_URL?: string;
} & Record<string, unknown>;

type RuntimeEnvOptions = {
  env?: EnvLike;
  bindings?: CloudflareBindings | null;
};

export type ServerRuntimeEnv = {
  databaseProvider: string;
  databaseUrl: string;
  dbSingletonEnabled: boolean;
  appEnvironment: string;
  internalEntitlementGrantsEnabled: boolean;
  authSecret: string;
  authBaseUrl: string;
};

const cloudflareBindingsStore =
  new AsyncLocalStorage<CloudflareBindings | null>();

export function runWithCloudflareBindings<T>(
  bindings: CloudflareBindings | null,
  callback: () => T
): T {
  return cloudflareBindingsStore.run(bindings, callback);
}

export function getCloudflareBindings(): CloudflareBindings | null {
  const scopedBindings = cloudflareBindingsStore.getStore();
  if (scopedBindings !== undefined) {
    return scopedBindings;
  }

  return null;
}

export function getCloudflareAIBinding(): CloudflareAIBinding | null {
  const binding = getCloudflareBindings()?.AI;
  return binding && typeof binding.run === 'function' ? binding : null;
}

export function getCloudflareImagesBinding(): ImagesBinding | null {
  const binding = getCloudflareBindings()?.IMAGES;
  return binding && typeof binding.input === 'function' ? binding : null;
}

function getBindingsValue(
  name: string,
  bindings: CloudflareBindings | null
): string | undefined {
  const value = bindings?.[name];
  return typeof value === 'string' ? value : undefined;
}

export function getRuntimeEnvString(
  name: string,
  options: RuntimeEnvOptions = {}
): string | undefined {
  const bindings =
    options.bindings === undefined ? getCloudflareBindings() : options.bindings;
  const bindingValue = getBindingsValue(name, bindings);
  if (bindingValue !== undefined) {
    return bindingValue;
  }

  return options.env?.[name] ?? process.env[name];
}

export function isRuntimeEnvEnabled(
  name: string,
  options: RuntimeEnvOptions = {}
): boolean {
  return getRuntimeEnvString(name, options) === 'true';
}

export function getServerRuntimeEnv(
  options: RuntimeEnvOptions = {}
): ServerRuntimeEnv {
  const envLike = {
    NEXT_PUBLIC_APP_URL: getRuntimeEnvString('NEXT_PUBLIC_APP_URL', options),
    BETTER_AUTH_URL: getRuntimeEnvString('BETTER_AUTH_URL', options),
    AUTH_URL: getRuntimeEnvString('AUTH_URL', options),
  };
  const databaseProvider =
    getRuntimeEnvString('DATABASE_PROVIDER', options) ?? '';
  const nodeEnv = getRuntimeEnvString('NODE_ENV', options);

  assertPostgresOnlyDatabaseProvider(databaseProvider);

  return {
    databaseProvider,
    databaseUrl: getRuntimeEnvString('DATABASE_URL', options) ?? '',
    dbSingletonEnabled: isRuntimeEnvEnabled('DB_SINGLETON_ENABLED', options),
    appEnvironment:
      getRuntimeEnvString('APP_ENVIRONMENT', options)?.trim() ||
      (nodeEnv === 'production' ? 'production' : 'local'),
    internalEntitlementGrantsEnabled: isRuntimeEnvEnabled(
      'INTERNAL_ENTITLEMENT_GRANTS_ENABLED',
      options
    ),
    authSecret:
      getRuntimeEnvString('BETTER_AUTH_SECRET', options) ??
      getRuntimeEnvString('AUTH_SECRET', options) ??
      '',
    authBaseUrl: resolveServerAuthBaseUrl(envLike),
  };
}

export function getServerPublicEnvConfigs(
  options: RuntimeEnvOptions = {}
): PublicEnvConfigs {
  const bindings =
    options.bindings === undefined ? getCloudflareBindings() : options.bindings;

  return resolvePublicEnvConfigs({
    nextPublicTheme: getRuntimeEnvString('NEXT_PUBLIC_THEME', {
      ...options,
      bindings,
    }),
    nextPublicDefaultLocale: getRuntimeEnvString('NEXT_PUBLIC_DEFAULT_LOCALE', {
      ...options,
      bindings,
    }),
    nextPublicTurnstileSiteKey: getRuntimeEnvString(
      'NEXT_PUBLIC_TURNSTILE_SITE_KEY',
      {
        ...options,
        bindings,
      }
    ),
  });
}

export function isCloudflareWorkersRuntime(): boolean {
  return isCloudflareWorker;
}

export function getRuntimePlatform(): RuntimePlatform {
  return isCloudflareWorkersRuntime() ? 'cloudflare-workers' : 'node';
}
