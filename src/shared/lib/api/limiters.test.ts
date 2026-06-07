import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CooldownLimiter,
  DualConcurrencyLimiter,
  FixedWindowAttemptLimiter,
  FixedWindowQuotaLimiter,
} from './limiters';
import { LimiterBucket } from './limiters-config';
import { createMemoryRateLimitStore } from './rate-limit-store';

test('CooldownLimiter: 冷却窗口内拒绝并返回 retryAfterSeconds', async () => {
  let now = 1_000;
  const limiter = new CooldownLimiter({
    bucket: LimiterBucket.API_SEND_EMAIL,
    minIntervalMs: 1_000,
    ttlMs: 10_000,
    now: () => now,
    store: createMemoryRateLimitStore(),
  });

  assert.equal((await limiter.checkAndConsume('u1')).allowed, true);

  now = 1_500;
  const denied = await limiter.check('u1');
  assert.equal(denied.allowed, false);
  assert.equal(denied.retryAfterSeconds, 1);

  now = 2_100;
  assert.equal((await limiter.check('u1')).allowed, true);
});

test('CooldownLimiter: rollback 只撤销同一时间戳写入', async () => {
  const limiter = new CooldownLimiter({
    bucket: LimiterBucket.API_SEND_EMAIL,
    minIntervalMs: 1_000,
    ttlMs: 10_000,
    store: createMemoryRateLimitStore(),
  });

  const first = await limiter.consume('u1', 1_000);
  const second = await limiter.consume('u1', 2_000);
  await limiter.rollback('u1', first);
  assert.equal((await limiter.check('u1', 2_100)).allowed, false);

  await limiter.rollback('u1', second);
  assert.equal((await limiter.check('u1', 2_100)).allowed, true);
});

test('CooldownLimiter: TTL 过期后自动清理并放行', async () => {
  let now = 1_000;
  const limiter = new CooldownLimiter({
    bucket: LimiterBucket.API_SEND_EMAIL,
    minIntervalMs: 10_000,
    ttlMs: 1_000,
    now: () => now,
    store: createMemoryRateLimitStore(),
  });

  await limiter.consume('u1');
  now = 2_500;
  assert.equal((await limiter.check('u1')).allowed, true);
});

test('FixedWindowAttemptLimiter: 达到上限后拒绝，成功后可清空', async () => {
  let now = 1_000;
  const limiter = new FixedWindowAttemptLimiter({
    bucket: LimiterBucket.API_VERIFY_EMAIL_CODE,
    windowMs: 10_000,
    maxAttempts: 3,
    now: () => now,
    store: createMemoryRateLimitStore(),
  });

  assert.equal((await limiter.recordFailure('u1')).attempts, 1);
  assert.equal((await limiter.recordFailure('u1')).attempts, 2);
  const third = await limiter.recordFailure('u1');
  assert.equal(third.attempts, 3);
  assert.equal(typeof third.retryAfterSeconds, 'number');

  const denied = await limiter.check('u1');
  assert.equal(denied.allowed, false);
  assert.equal(typeof denied.retryAfterSeconds, 'number');

  await limiter.clear('u1');
  assert.equal((await limiter.check('u1')).allowed, true);

  now = 20_000;
  assert.equal((await limiter.check('u1')).allowed, true);
});

test('FixedWindowAttemptLimiter: 窗口过期后自动放行', async () => {
  let now = 1_000;
  const limiter = new FixedWindowAttemptLimiter({
    bucket: LimiterBucket.API_VERIFY_EMAIL_CODE,
    windowMs: 1_000,
    maxAttempts: 1,
    now: () => now,
    store: createMemoryRateLimitStore(),
  });

  await limiter.recordFailure('u1');
  assert.equal((await limiter.check('u1')).allowed, false);

  now = 2_001;
  assert.equal((await limiter.check('u1')).allowed, true);
});

test('FixedWindowQuotaLimiter: 同时覆盖次数上限和并发上限', async () => {
  let now = 1_000;
  const limiter = new FixedWindowQuotaLimiter({
    bucket: LimiterBucket.API_EMAIL_TEST,
    windowMs: 10_000,
    maxAttempts: 2,
    maxConcurrent: 1,
    now: () => now,
    store: createMemoryRateLimitStore(),
  });

  assert.equal((await limiter.acquire('u1')).allowed, true);
  const concurrencyDenied = await limiter.acquire('u1');
  assert.equal(concurrencyDenied.allowed, false);
  assert.equal(concurrencyDenied.reason, 'concurrency_limit');

  await limiter.release('u1');
  assert.equal((await limiter.acquire('u1')).allowed, true);
  await limiter.release('u1');

  const rateDenied = await limiter.acquire('u1');
  assert.equal(rateDenied.allowed, false);
  assert.equal(rateDenied.reason, 'rate_limited');

  now = 20_000;
  assert.equal((await limiter.acquire('u1')).allowed, true);
});

test('FixedWindowQuotaLimiter: clear resets the quota window', async () => {
  const limiter = new FixedWindowQuotaLimiter({
    bucket: LimiterBucket.API_EMAIL_TEST,
    windowMs: 10_000,
    maxAttempts: 1,
    maxConcurrent: 1,
    store: createMemoryRateLimitStore(),
  });

  assert.equal((await limiter.acquire('u1')).allowed, true);
  await limiter.release('u1');
  assert.equal((await limiter.acquire('u1')).allowed, false);

  await limiter.clear('u1');
  assert.equal((await limiter.acquire('u1')).allowed, true);
});

test('DualConcurrencyLimiter: 同时限制全局并发和单 key 并发', async () => {
  const limiter = new DualConcurrencyLimiter({
    bucket: LimiterBucket.API_STORAGE_UPLOAD,
    maxGlobal: 2,
    maxPerKey: 1,
    leaseMs: 5_000,
    store: createMemoryRateLimitStore(),
  });

  assert.equal(await limiter.acquire('u1'), true);
  assert.equal(await limiter.acquire('u1'), false);
  assert.equal(await limiter.acquire('u2'), true);
  assert.equal(await limiter.acquire('u3'), false);

  await limiter.release('u1');
  assert.equal(await limiter.acquire('u3'), true);
});
