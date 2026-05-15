import { SETTINGS_EMAIL_VERIFICATION_CODE_TTL_MS } from '@/shared/constants/email';

export const LimiterBucket = {
  API_SEND_EMAIL: 'api.send-email',
  API_AI_QUERY: 'api.ai-query',
  API_VERIFY_EMAIL_CODE: 'api.verify-email-code',
  API_EMAIL_TEST: 'api.email-test',
  API_STORAGE_UPLOAD: 'api.storage-upload',
  API_REMOVER_GUEST_UPLOAD: 'api.remover.guest-upload',
  API_REMOVER_GUEST_JOB: 'api.remover.guest-job',
  AUTH_RESET_PASSWORD: 'auth.reset-password',
} as const;

export type LimiterBucket =
  (typeof LimiterBucket)[keyof typeof LimiterBucket];

export const SEND_EMAIL_RATE_LIMIT_CONFIG = {
  bucket: LimiterBucket.API_SEND_EMAIL,
  minIntervalMs: 60_000,
  ttlMs: 15 * 60 * 1000,
} as const;

export const AI_QUERY_RATE_LIMIT_CONFIG = {
  bucket: LimiterBucket.API_AI_QUERY,
  minIntervalMs: 4_000,
  ttlMs: 60 * 60 * 1000,
} as const;

export const VERIFY_CODE_ATTEMPT_LIMIT_CONFIG = {
  bucket: LimiterBucket.API_VERIFY_EMAIL_CODE,
  windowMs: SETTINGS_EMAIL_VERIFICATION_CODE_TTL_MS,
  maxAttempts: 5,
} as const;

export const EMAIL_TEST_QUOTA_LIMIT_CONFIG = {
  bucket: LimiterBucket.API_EMAIL_TEST,
  windowMs: 5 * 60 * 1000,
  maxAttempts: 3,
  maxConcurrent: 1,
} as const;

export const STORAGE_UPLOAD_CONCURRENCY_LIMIT_CONFIG = {
  bucket: LimiterBucket.API_STORAGE_UPLOAD,
  maxGlobal: 4,
  maxPerKey: 2,
  leaseMs: 15 * 60 * 1000,
} as const;

export const REMOVER_GUEST_UPLOAD_LIMIT_CONFIG = {
  bucket: LimiterBucket.API_REMOVER_GUEST_UPLOAD,
  windowMs: 24 * 60 * 60 * 1000,
  maxAttempts: 4,
  maxConcurrent: 4,
} as const;

export const REMOVER_GUEST_JOB_LIMIT_CONFIG = {
  bucket: LimiterBucket.API_REMOVER_GUEST_JOB,
  windowMs: 24 * 60 * 60 * 1000,
  maxAttempts: 2,
  maxConcurrent: 2,
} as const;
