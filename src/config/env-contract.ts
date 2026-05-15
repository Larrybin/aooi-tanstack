type EnvValue = string | null | undefined;
export type EnvLike = Record<string, EnvValue>;

export const PUBLIC_ENV_KEYS = [
  'NEXT_PUBLIC_APP_URL',
  'NEXT_PUBLIC_THEME',
  'NEXT_PUBLIC_DEFAULT_LOCALE',
  'NEXT_PUBLIC_DEBUG',
] as const;

export const SERVER_RUNTIME_ENV_KEYS = [
  ...PUBLIC_ENV_KEYS,
  'NODE_ENV',
  'CI',
  'NEXT_RUNTIME',
  'NEXT_PHASE',
  'npm_lifecycle_event',
  'DATABASE_PROVIDER',
  'DATABASE_URL',
  'DB_SINGLETON_ENABLED',
  'BETTER_AUTH_SECRET',
  'AUTH_SECRET',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'GITHUB_CLIENT_ID',
  'GITHUB_CLIENT_SECRET',
  'RESEND_API_KEY',
  'BETTER_AUTH_URL',
  'AUTH_URL',
  'CF_LOCAL_AUTH_DEBUG',
  'CF_LOCAL_SMOKE_WORKERS_DEV',
  'AUTH_SPIKE_OAUTH_CONFIG_SEED',
  'AUTH_SPIKE_OAUTH_UPSTREAM_MOCK',
  'STRIPE_PUBLISHABLE_KEY',
  'STRIPE_SECRET_KEY',
  'STRIPE_SIGNING_SECRET',
  'CREEM_API_KEY',
  'CREEM_SIGNING_SECRET',
  'PAYPAL_CLIENT_ID',
  'PAYPAL_CLIENT_SECRET',
  'PAYPAL_WEBHOOK_ID',
  'OPENROUTER_API_KEY',
  'REPLICATE_API_TOKEN',
  'FAL_API_KEY',
  'KIE_API_KEY',
  'AI_NOTIFY_WEBHOOK_SECRET',
  'REMOVER_AI_PROVIDER',
  'REMOVER_AI_MODEL',
  'REMOVER_CLEANUP_SECRET',
  'STORAGE_SPIKE_UPLOAD_MOCK',
  'STORAGE_PUBLIC_BASE_URL',
] as const;

export const CLOUDFLARE_SECRET_ENV_KEYS = [
  'BETTER_AUTH_SECRET',
  'AUTH_SECRET',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'GITHUB_CLIENT_ID',
  'GITHUB_CLIENT_SECRET',
  'RESEND_API_KEY',
  'STRIPE_PUBLISHABLE_KEY',
  'STRIPE_SECRET_KEY',
  'STRIPE_SIGNING_SECRET',
  'CREEM_API_KEY',
  'CREEM_SIGNING_SECRET',
  'PAYPAL_CLIENT_ID',
  'PAYPAL_CLIENT_SECRET',
  'PAYPAL_WEBHOOK_ID',
  'OPENROUTER_API_KEY',
  'REPLICATE_API_TOKEN',
  'FAL_API_KEY',
  'KIE_API_KEY',
  'AI_NOTIFY_WEBHOOK_SECRET',
  'REMOVER_CLEANUP_SECRET',
] as const;

export const DEV_VARS_ALLOWED_KEYS = [
  ...CLOUDFLARE_SECRET_ENV_KEYS,
  'DEPLOY_TARGET',
  'CF_LOCAL_WRANGLER_CONFIG_PATH',
  'NEXT_PUBLIC_APP_URL',
  'AUTH_URL',
  'BETTER_AUTH_URL',
  'CF_LOCAL_SMOKE_WORKERS_DEV',
  'CF_LOCAL_AUTH_DEBUG',
  'AUTH_SPIKE_OAUTH_CONFIG_SEED',
  'AUTH_SPIKE_OAUTH_UPSTREAM_MOCK',
  'REMOVER_AI_PROVIDER',
  'REMOVER_AI_MODEL',
  'STORAGE_PUBLIC_BASE_URL',
  'STORAGE_SPIKE_UPLOAD_MOCK',
] as const;

const PUBLIC_ENV_KEY_SET = new Set<string>(PUBLIC_ENV_KEYS);

function readRawEnvValue(env: EnvLike | undefined, name: string): EnvValue {
  return env?.[name];
}

export function getEnvValue(
  env: EnvLike | undefined = process.env,
  name: string
): string | undefined {
  const value = readRawEnvValue(env, name);
  return typeof value === 'string' ? value : undefined;
}

export function getTrimmedEnvValue(
  env: EnvLike | undefined = process.env,
  name: string
): string | undefined {
  const value = getEnvValue(env, name)?.trim();
  return value ? value : undefined;
}

export function isEnvEnabled(
  env: EnvLike | undefined = process.env,
  name: string
): boolean {
  return getTrimmedEnvValue(env, name) === 'true';
}

export function getNodeEnv(env: EnvLike | undefined = process.env): string {
  return getTrimmedEnvValue(env, 'NODE_ENV') || 'development';
}

export function isProductionEnv(
  env: EnvLike | undefined = process.env
): boolean {
  return getNodeEnv(env) === 'production';
}

export function isCiEnv(env: EnvLike | undefined = process.env): boolean {
  return isEnvEnabled(env, 'CI');
}

export function isDebugEnv(env: EnvLike | undefined = process.env): boolean {
  return isEnvEnabled(env, 'NEXT_PUBLIC_DEBUG');
}

export function pickEnvValues<T extends string>(
  env: EnvLike | undefined,
  keys: readonly T[]
): Partial<Record<T, string>> {
  const picked: Partial<Record<T, string>> = {};

  for (const key of keys) {
    const value = getEnvValue(env, key);
    if (value !== undefined) {
      picked[key] = value;
    }
  }

  return picked;
}

export function assertAllowedEnvKeys(
  values: Record<string, string | undefined>,
  allowedKeys: readonly string[],
  label: string
) {
  const allowedKeySet = new Set(allowedKeys);
  const invalidKeys = Object.keys(values)
    .filter((key) => values[key] !== undefined)
    .filter((key) => !allowedKeySet.has(key))
    .sort();

  if (invalidKeys.length === 0) {
    return;
  }

  throw new Error(
    `${label} contains unsupported keys: ${invalidKeys.join(', ')}`
  );
}

export function findUnknownPublicEnvKeys(keys: Iterable<string>): string[] {
  return Array.from(
    new Set(
      Array.from(keys)
        .filter((key) => key.startsWith('NEXT_PUBLIC_'))
        .filter((key) => !PUBLIC_ENV_KEY_SET.has(key))
    )
  ).sort();
}

export function parseEnvAssignments(content: string): Record<string, string> {
  const entries: Record<string, string> = {};

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const match = line.match(
      /^(?:export\s+)?([A-Z0-9_]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|(.*))$/
    );
    if (!match) {
      continue;
    }

    const [, key, doubleQuoted, singleQuoted, unquoted] = match;
    const value = doubleQuoted ?? singleQuoted ?? (unquoted || '').trim();
    entries[key] = value;
  }

  return entries;
}
