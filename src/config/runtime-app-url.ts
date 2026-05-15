import { site } from '@/site';

import type { EnvLike } from '@/config/env-contract';

type RuntimeAppUrlEnv = Partial<Pick<EnvLike, 'NEXT_PUBLIC_APP_URL'>>;

function normalizeAppOrigin(value: string, label: string): string {
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

export function resolveRuntimeAppUrl(env: RuntimeAppUrlEnv = {}): string {
  const runtimeEnv = env;
  const runtimeAppUrl = runtimeEnv.NEXT_PUBLIC_APP_URL?.trim();
  return normalizeAppOrigin(
    runtimeAppUrl || site.brand.appUrl,
    runtimeAppUrl ? 'NEXT_PUBLIC_APP_URL' : 'site.brand.appUrl'
  );
}
