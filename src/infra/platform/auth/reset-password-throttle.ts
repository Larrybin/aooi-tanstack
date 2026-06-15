
import { createLimiterFactory } from '@/shared/lib/api/limiters-factory';
import { normalizeEmail } from '@/shared/lib/email';

const RESET_PASSWORD_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const RESET_PASSWORD_MAX_ATTEMPTS = 3;
const RESET_PASSWORD_MAX_CONCURRENT = 1;

const resetPasswordQuotaLimiter = createLimiterFactory({
  resetPasswordQuotaConfig: {
    bucket: 'auth.reset-password',
    windowMs: RESET_PASSWORD_WINDOW_MS,
    maxAttempts: RESET_PASSWORD_MAX_ATTEMPTS,
    maxConcurrent: RESET_PASSWORD_MAX_CONCURRENT,
  },
}).createResetPasswordQuotaLimiter();

export type ConsumeResetPasswordQuotaResult =
  | {
      allowed: true;
      scopeKey: string;
    }
  | {
      allowed: false;
      reason: 'rate_limited' | 'concurrency_limit';
    };

function buildScopeKey(email: string): string {
  return normalizeEmail(email);
}

export async function consumeResetPasswordQuota(
  email: string
): Promise<ConsumeResetPasswordQuotaResult> {
  const scopeKey = buildScopeKey(email);
  const result = await resetPasswordQuotaLimiter.acquire(scopeKey);

  if (!result.allowed) {
    return {
      allowed: false,
      reason:
        result.reason === 'concurrency_limit'
          ? 'concurrency_limit'
          : 'rate_limited',
    };
  }

  return {
    allowed: true,
    scopeKey,
  };
}

export async function releaseResetPasswordQuota(scopeKey: string) {
  if (!scopeKey?.trim()) return;
  await resetPasswordQuotaLimiter.release(scopeKey.trim());
}
