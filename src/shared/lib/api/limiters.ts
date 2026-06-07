import type { LimiterBucket } from '@/shared/lib/api/limiters-config';
import {
  createMemoryRateLimitStore,
  type LockedRateLimitStore,
  type RateLimitStore,
} from '@/shared/lib/api/rate-limit-store';

export type DeniedLimitResult = {
  allowed: false;
  retryAfterSeconds?: number;
  reason?: string;
};

export type AllowedLimitResult = {
  allowed: true;
};

export type LimitResult = AllowedLimitResult | DeniedLimitResult;

type RateLimitBaseConfig = {
  bucket: LimiterBucket;
  store?: RateLimitStore;
};

function maxRetryAfterSeconds(remainingMs: number): number {
  return Math.max(1, Math.ceil(remainingMs / 1000));
}

function getRateLimitStore(store?: RateLimitStore): RateLimitStore {
  return store ?? createMemoryRateLimitStore();
}

export class CooldownLimiter {
  private readonly store: RateLimitStore;

  constructor(
    private readonly config: RateLimitBaseConfig & {
      minIntervalMs: number;
      ttlMs: number;
      now?: () => number;
    }
  ) {
    this.store = getRateLimitStore(config.store);
  }

  async check(key: string, now = this.getNow()): Promise<LimitResult> {
    return this.store.withLock(this.config.bucket, [key], async (store) => {
      await store.deleteExpired(now);
      const state = await store.get(key);
      if (!state?.lastActionAt) {
        return { allowed: true };
      }
      if (now - state.lastActionAt >= this.config.minIntervalMs) {
        return { allowed: true };
      }
      return {
        allowed: false,
        retryAfterSeconds: maxRetryAfterSeconds(
          this.config.minIntervalMs - (now - state.lastActionAt)
        ),
      };
    });
  }

  async checkAndConsume(
    key: string,
    now = this.getNow()
  ): Promise<LimitResult> {
    return this.store.withLock(this.config.bucket, [key], async (store) => {
      await store.deleteExpired(now);
      const state = await store.get(key);
      if (
        state?.lastActionAt &&
        now - state.lastActionAt < this.config.minIntervalMs
      ) {
        return {
          allowed: false,
          retryAfterSeconds: maxRetryAfterSeconds(
            this.config.minIntervalMs - (now - state.lastActionAt)
          ),
        };
      }

      await store.set({
        bucket: this.config.bucket,
        scopeKey: key,
        lastActionAt: now,
        windowStartedAt: null,
        count: 0,
        inflight: 0,
        expiresAt: now + this.config.ttlMs,
      });
      return { allowed: true };
    });
  }

  async consume(key: string, now = this.getNow()): Promise<number> {
    await this.store.withLock(this.config.bucket, [key], async (store) => {
      await store.set({
        bucket: this.config.bucket,
        scopeKey: key,
        lastActionAt: now,
        windowStartedAt: null,
        count: 0,
        inflight: 0,
        expiresAt: now + this.config.ttlMs,
      });
    });
    return now;
  }

  async rollback(key: string, consumedAt: number): Promise<void> {
    await this.store.withLock(this.config.bucket, [key], async (store) => {
      const state = await store.get(key);
      if (state?.lastActionAt === consumedAt) {
        await store.delete(key);
      }
    });
  }

  async clear(key: string): Promise<void> {
    await this.store.withLock(this.config.bucket, [key], async (store) => {
      await store.delete(key);
    });
  }

  private getNow(): number {
    return (this.config.now ?? Date.now)();
  }
}

export class FixedWindowAttemptLimiter {
  private readonly store: RateLimitStore;

  constructor(
    private readonly config: RateLimitBaseConfig & {
      windowMs: number;
      maxAttempts: number;
      now?: () => number;
    }
  ) {
    this.store = getRateLimitStore(config.store);
  }

  async check(key: string, now = this.getNow()): Promise<LimitResult> {
    return this.store.withLock(this.config.bucket, [key], async (store) => {
      await store.deleteExpired(now);
      const state = await store.get(key);
      if (!state?.windowStartedAt) {
        return { allowed: true };
      }
      if (now - state.windowStartedAt > this.config.windowMs) {
        await store.delete(key);
        return { allowed: true };
      }
      if (state.count < this.config.maxAttempts) {
        return { allowed: true };
      }
      return {
        allowed: false,
        retryAfterSeconds: maxRetryAfterSeconds(
          this.config.windowMs - (now - state.windowStartedAt)
        ),
      };
    });
  }

  async recordFailure(
    key: string,
    now = this.getNow()
  ): Promise<{ attempts: number; retryAfterSeconds?: number }> {
    return this.store.withLock(this.config.bucket, [key], async (store) => {
      await store.deleteExpired(now);
      const state = await store.get(key);

      const nextState =
        !state?.windowStartedAt ||
        now - state.windowStartedAt > this.config.windowMs
          ? {
              bucket: this.config.bucket,
              scopeKey: key,
              lastActionAt: null,
              windowStartedAt: now,
              count: 1,
              inflight: 0,
              expiresAt: now + this.config.windowMs,
            }
          : {
              ...state,
              count: state.count + 1,
              expiresAt: state.windowStartedAt + this.config.windowMs,
            };

      await store.set(nextState);

      if (nextState.count < this.config.maxAttempts) {
        return { attempts: nextState.count };
      }

      return {
        attempts: nextState.count,
        retryAfterSeconds: maxRetryAfterSeconds(nextState.expiresAt - now),
      };
    });
  }

  async clear(key: string): Promise<void> {
    await this.store.withLock(this.config.bucket, [key], async (store) => {
      await store.delete(key);
    });
  }

  private getNow(): number {
    return (this.config.now ?? Date.now)();
  }
}

export class FixedWindowQuotaLimiter {
  private readonly store: RateLimitStore;

  constructor(
    private readonly config: RateLimitBaseConfig & {
      windowMs: number;
      maxAttempts: number;
      maxConcurrent: number;
      now?: () => number;
    }
  ) {
    this.store = getRateLimitStore(config.store);
  }

  async acquire(
    key: string,
    now = this.getNow()
  ): Promise<AllowedLimitResult | DeniedLimitResult> {
    return this.store.withLock(this.config.bucket, [key], async (store) => {
      await store.deleteExpired(now);
      const state = await store.get(key);
      const nextState =
        !state?.windowStartedAt ||
        now - state.windowStartedAt > this.config.windowMs
          ? {
              bucket: this.config.bucket,
              scopeKey: key,
              lastActionAt: null,
              windowStartedAt: now,
              count: 0,
              inflight: 0,
              expiresAt: now + this.config.windowMs,
            }
          : state;

      if (nextState.count >= this.config.maxAttempts) {
        return { allowed: false, reason: 'rate_limited' };
      }

      if (nextState.inflight >= this.config.maxConcurrent) {
        return { allowed: false, reason: 'concurrency_limit' };
      }

      await store.set({
        ...nextState,
        count: nextState.count + 1,
        inflight: nextState.inflight + 1,
      });

      return { allowed: true };
    });
  }

  async release(key: string, now = this.getNow()): Promise<void> {
    await this.store.withLock(this.config.bucket, [key], async (store) => {
      await store.deleteExpired(now);
      const state = await store.get(key);
      if (!state) return;

      const nextInflight = Math.max(0, state.inflight - 1);
      if (nextInflight === 0 && state.count === 0) {
        await store.delete(key);
        return;
      }

      await store.set({
        ...state,
        inflight: nextInflight,
      });
    });
  }

  async clear(key: string): Promise<void> {
    await this.store.withLock(this.config.bucket, [key], async (store) => {
      await store.delete(key);
    });
  }

  private getNow(): number {
    return (this.config.now ?? Date.now)();
  }
}

export class DualConcurrencyLimiter {
  private readonly store: RateLimitStore;

  constructor(
    private readonly config: RateLimitBaseConfig & {
      maxGlobal: number;
      maxPerKey: number;
      leaseMs: number;
      now?: () => number;
    }
  ) {
    this.store = getRateLimitStore(config.store);
  }

  async acquire(key: string, now = this.getNow()): Promise<boolean> {
    return this.store.withLock(
      this.config.bucket,
      [GLOBAL_SCOPE_KEY, key],
      async (store) => {
        await store.deleteExpired(now);
        const states = await store.getMany([GLOBAL_SCOPE_KEY, key]);

        const globalState =
          states.get(GLOBAL_SCOPE_KEY) ||
          createConcurrencyState(
            this.config.bucket,
            GLOBAL_SCOPE_KEY,
            now,
            this.config.leaseMs
          );
        const perKeyState =
          states.get(key) ||
          createConcurrencyState(
            this.config.bucket,
            key,
            now,
            this.config.leaseMs
          );

        if (globalState.inflight >= this.config.maxGlobal) {
          return false;
        }

        if (perKeyState.inflight >= this.config.maxPerKey) {
          return false;
        }

        await store.set({
          ...globalState,
          inflight: globalState.inflight + 1,
          expiresAt: now + this.config.leaseMs,
        });
        await store.set({
          ...perKeyState,
          inflight: perKeyState.inflight + 1,
          expiresAt: now + this.config.leaseMs,
        });
        return true;
      }
    );
  }

  async release(key: string, now = this.getNow()): Promise<void> {
    await this.store.withLock(
      this.config.bucket,
      [GLOBAL_SCOPE_KEY, key],
      async (store) => {
        await store.deleteExpired(now);
        const states = await store.getMany([GLOBAL_SCOPE_KEY, key]);

        await releaseConcurrencyState({
          store,
          state: states.get(GLOBAL_SCOPE_KEY) || null,
          scopeKey: GLOBAL_SCOPE_KEY,
        });
        await releaseConcurrencyState({
          store,
          state: states.get(key) || null,
          scopeKey: key,
        });
      }
    );
  }

  private getNow(): number {
    return (this.config.now ?? Date.now)();
  }
}

const GLOBAL_SCOPE_KEY = '__global__';

function createConcurrencyState(
  bucket: LimiterBucket,
  scopeKey: string,
  now: number,
  leaseMs: number
) {
  return {
    bucket,
    scopeKey,
    lastActionAt: null,
    windowStartedAt: null,
    count: 0,
    inflight: 0,
    expiresAt: now + leaseMs,
  };
}

async function releaseConcurrencyState({
  store,
  state,
  scopeKey,
}: {
  store: LockedRateLimitStore;
  state: {
    bucket: LimiterBucket;
    scopeKey: string;
    lastActionAt: number | null;
    windowStartedAt: number | null;
    count: number;
    inflight: number;
    expiresAt: number;
  } | null;
  scopeKey: string;
}) {
  if (!state) return;

  const nextInflight = Math.max(0, state.inflight - 1);
  if (nextInflight === 0) {
    await store.delete(scopeKey);
    return;
  }

  await store.set({
    ...state,
    inflight: nextInflight,
  });
}
