import type { EnvLike } from '@/config/env-contract';

import { resolveRuntimeAppUrl } from './runtime-app-url';

function normalizeOrigin(value: string, label: string): string {
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error('must use http/https');
    }
    return url.origin;
  } catch (error) {
    throw new Error(`Invalid ${label}: ${value} (${String(error)})`);
  }
}

type ServerAuthBaseUrlEnv = Partial<
  Pick<EnvLike, 'BETTER_AUTH_URL' | 'AUTH_URL' | 'NEXT_PUBLIC_APP_URL'>
>;

export function resolveServerAuthBaseUrl(env?: ServerAuthBaseUrlEnv): string {
  const runtimeEnv = env ?? process.env;
  const rawBetterAuthUrl = runtimeEnv.BETTER_AUTH_URL?.trim() || '';
  const rawAuthUrl = runtimeEnv.AUTH_URL?.trim() || '';
  const runtimeOrigin = resolveRuntimeAppUrl({
    NEXT_PUBLIC_APP_URL: runtimeEnv.NEXT_PUBLIC_APP_URL,
  });

  for (const [label, value] of [
    ['BETTER_AUTH_URL', rawBetterAuthUrl],
    ['AUTH_URL', rawAuthUrl],
  ] as const) {
    if (!value) {
      continue;
    }

    const authOrigin = normalizeOrigin(value, label);
    if (authOrigin !== runtimeOrigin) {
      throw new Error(
        `${label} must share the same origin as the runtime app URL (expected ${runtimeOrigin}, got ${authOrigin})`
      );
    }
  }

  return runtimeOrigin;
}
