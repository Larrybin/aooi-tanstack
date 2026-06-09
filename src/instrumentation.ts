import { getServerRuntimeEnv } from '@/infra/runtime/env.server';
import { site } from '@/site';

import { getTrimmedEnvValue } from '@/config/env-contract';
import { isProductionEnv } from '@/shared/lib/env';

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export const runtime = 'nodejs';

function getAuthSecret(): string | null {
  const secret = getServerRuntimeEnv().authSecret;
  return isNonEmptyString(secret) ? secret.trim() : null;
}

function isAuthEnabled(): boolean {
  return site.capabilities.auth !== false;
}

function formatConfigError(parts: string[]): Error {
  return new Error(parts.filter(Boolean).join(' '));
}

export async function register() {
  const runtime = getTrimmedEnvValue(undefined, 'NEXT_RUNTIME');
  if (runtime === 'edge') {
    return;
  }

  if (!isProductionEnv()) {
    return;
  }

  if (!isAuthEnabled()) {
    return;
  }

  const secret = getAuthSecret();
  if (!secret) {
    throw formatConfigError([
      'Auth config check failed in production: missing BETTER_AUTH_SECRET/AUTH_SECRET.',
      'Set one of these environment variables to a strong random value.',
    ]);
  }
}
