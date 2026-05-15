import { isCloudflareWorkersRuntime } from '@/infra/runtime/env.server';

import {
  CooldownLimiter,
  DualConcurrencyLimiter,
  FixedWindowAttemptLimiter,
  FixedWindowQuotaLimiter,
} from '@/shared/lib/api/limiters';
import {
  AI_QUERY_RATE_LIMIT_CONFIG,
  EMAIL_TEST_QUOTA_LIMIT_CONFIG,
  LimiterBucket,
  REMOVER_GUEST_JOB_LIMIT_CONFIG,
  REMOVER_GUEST_UPLOAD_LIMIT_CONFIG,
  SEND_EMAIL_RATE_LIMIT_CONFIG,
  STORAGE_UPLOAD_CONCURRENCY_LIMIT_CONFIG,
  VERIFY_CODE_ATTEMPT_LIMIT_CONFIG,
} from '@/shared/lib/api/limiters-config';
import {
  createMemoryRateLimitStore,
  type RateLimitStore,
} from '@/shared/lib/api/rate-limit-store';
import {
  CloudflareAttemptLimiter,
  CloudflareCooldownLimiter,
  CloudflareDualConcurrencyLimiter,
  CloudflareQuotaLimiter,
} from '@/shared/platform/cloudflare/stateful-limiters';

type ResetPasswordQuotaConfig = {
  bucket: LimiterBucket;
  windowMs: number;
  maxAttempts: number;
  maxConcurrent: number;
};

type LimiterFactoryOptions = {
  store?: RateLimitStore;
  now?: () => number;
  resetPasswordQuotaConfig?: ResetPasswordQuotaConfig;
};

const DEFAULT_RESET_PASSWORD_QUOTA_CONFIG = {
  bucket: LimiterBucket.AUTH_RESET_PASSWORD,
  windowMs: 5 * 60 * 1000,
  maxAttempts: 3,
  maxConcurrent: 1,
} as const satisfies ResetPasswordQuotaConfig;

function createStoreBackedFactory(
  store: RateLimitStore,
  now: () => number,
  resetPasswordQuotaConfig: ResetPasswordQuotaConfig
) {
  return {
    createSendEmailCooldownLimiter() {
      return new CooldownLimiter({
        ...SEND_EMAIL_RATE_LIMIT_CONFIG,
        now,
        store,
      });
    },
    createAiQueryCooldownLimiter() {
      return new CooldownLimiter({
        ...AI_QUERY_RATE_LIMIT_CONFIG,
        now,
        store,
      });
    },
    createVerifyCodeAttemptLimiter() {
      return new FixedWindowAttemptLimiter({
        ...VERIFY_CODE_ATTEMPT_LIMIT_CONFIG,
        now,
        store,
      });
    },
    createEmailTestQuotaLimiter() {
      return new FixedWindowQuotaLimiter({
        ...EMAIL_TEST_QUOTA_LIMIT_CONFIG,
        now,
        store,
      });
    },
    createResetPasswordQuotaLimiter() {
      return new FixedWindowQuotaLimiter({
        ...resetPasswordQuotaConfig,
        now,
        store,
      });
    },
    createStorageUploadConcurrencyLimiter() {
      return new DualConcurrencyLimiter({
        ...STORAGE_UPLOAD_CONCURRENCY_LIMIT_CONFIG,
        now,
        store,
      });
    },
    createRemoverGuestUploadLimiter() {
      return new FixedWindowQuotaLimiter({
        ...REMOVER_GUEST_UPLOAD_LIMIT_CONFIG,
        now,
        store,
      });
    },
    createRemoverGuestJobLimiter() {
      return new FixedWindowQuotaLimiter({
        ...REMOVER_GUEST_JOB_LIMIT_CONFIG,
        now,
        store,
      });
    },
  };
}

function createCloudflareFactory(
  now: () => number,
  resetPasswordQuotaConfig: ResetPasswordQuotaConfig
) {
  return {
    createSendEmailCooldownLimiter() {
      return new CloudflareCooldownLimiter(SEND_EMAIL_RATE_LIMIT_CONFIG, now);
    },
    createAiQueryCooldownLimiter() {
      return new CloudflareCooldownLimiter(AI_QUERY_RATE_LIMIT_CONFIG, now);
    },
    createVerifyCodeAttemptLimiter() {
      return new CloudflareAttemptLimiter(
        VERIFY_CODE_ATTEMPT_LIMIT_CONFIG,
        now
      );
    },
    createEmailTestQuotaLimiter() {
      return new CloudflareQuotaLimiter(EMAIL_TEST_QUOTA_LIMIT_CONFIG, now);
    },
    createResetPasswordQuotaLimiter() {
      return new CloudflareQuotaLimiter(resetPasswordQuotaConfig, now);
    },
    createStorageUploadConcurrencyLimiter() {
      return new CloudflareDualConcurrencyLimiter(
        STORAGE_UPLOAD_CONCURRENCY_LIMIT_CONFIG,
        now
      );
    },
    createRemoverGuestUploadLimiter() {
      return new CloudflareQuotaLimiter(REMOVER_GUEST_UPLOAD_LIMIT_CONFIG, now);
    },
    createRemoverGuestJobLimiter() {
      return new CloudflareQuotaLimiter(REMOVER_GUEST_JOB_LIMIT_CONFIG, now);
    },
  };
}

export function createLimiterFactory(options: LimiterFactoryOptions = {}) {
  const now = options.now ?? Date.now;
  const resetPasswordQuotaConfig =
    options.resetPasswordQuotaConfig ?? DEFAULT_RESET_PASSWORD_QUOTA_CONFIG;

  if (options.store) {
    return createStoreBackedFactory(
      options.store,
      now,
      resetPasswordQuotaConfig
    );
  }

  if (isCloudflareWorkersRuntime()) {
    return createCloudflareFactory(now, resetPasswordQuotaConfig);
  }

  return createStoreBackedFactory(
    createMemoryRateLimitStore(),
    now,
    resetPasswordQuotaConfig
  );
}
