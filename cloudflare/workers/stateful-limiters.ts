import {
  CooldownLimiter,
  DualConcurrencyLimiter,
  FixedWindowAttemptLimiter,
  FixedWindowQuotaLimiter,
} from '@/shared/lib/api/limiters';
import type { LimiterBucket } from '@/shared/lib/api/limiters-config';
import type {
  LockedRateLimitStore,
  RateLimitStateRecord,
  RateLimitStore,
} from '@/shared/lib/api/rate-limit-store';

type DurableObjectStorageLike = {
  get<T = unknown>(key: string): Promise<T | undefined>;
  put<T>(key: string, value: T): Promise<void>;
  delete(key: string[]): Promise<number>;
};

type DurableObjectStateLike = {
  readonly storage: DurableObjectStorageLike;
};

type DurableObjectRequestBody =
  | {
      action:
        | 'cooldown.check'
        | 'cooldown.checkAndConsume'
        | 'cooldown.consume';
      bucket: string;
      canonicalBucket: LimiterBucket;
      key: string;
      now: number;
      config: {
        bucket: LimiterBucket;
        minIntervalMs: number;
        ttlMs: number;
      };
    }
  | {
      action: 'cooldown.rollback';
      bucket: string;
      canonicalBucket: LimiterBucket;
      key: string;
      consumedAt: number;
      config: {
        bucket: LimiterBucket;
        minIntervalMs: number;
        ttlMs: number;
      };
    }
  | {
      action: 'cooldown.clear';
      bucket: string;
      canonicalBucket: LimiterBucket;
      key: string;
      config: {
        bucket: LimiterBucket;
        minIntervalMs: number;
        ttlMs: number;
      };
    }
  | {
      action: 'attempt.check';
      bucket: string;
      canonicalBucket: LimiterBucket;
      key: string;
      now: number;
      config: {
        bucket: LimiterBucket;
        windowMs: number;
        maxAttempts: number;
      };
    }
  | {
      action: 'attempt.recordFailure';
      bucket: string;
      canonicalBucket: LimiterBucket;
      key: string;
      now: number;
      config: {
        bucket: LimiterBucket;
        windowMs: number;
        maxAttempts: number;
      };
    }
  | {
      action: 'attempt.clear';
      bucket: string;
      canonicalBucket: LimiterBucket;
      key: string;
      config: {
        bucket: LimiterBucket;
        windowMs: number;
        maxAttempts: number;
      };
    }
  | {
      action: 'quota.acquire';
      bucket: string;
      canonicalBucket: LimiterBucket;
      key: string;
      now: number;
      config: {
        bucket: LimiterBucket;
        windowMs: number;
        maxAttempts: number;
        maxConcurrent: number;
      };
    }
  | {
      action: 'quota.release';
      bucket: string;
      canonicalBucket: LimiterBucket;
      key: string;
      now: number;
      config: {
        bucket: LimiterBucket;
        windowMs: number;
        maxAttempts: number;
        maxConcurrent: number;
      };
    }
  | {
      action: 'quota.clear';
      bucket: string;
      canonicalBucket: LimiterBucket;
      key: string;
      config: {
        bucket: LimiterBucket;
        windowMs: number;
        maxAttempts: number;
        maxConcurrent: number;
      };
    }
  | {
      action: 'dual.acquire';
      bucket: string;
      canonicalBucket: LimiterBucket;
      key: string;
      now: number;
      config: {
        bucket: LimiterBucket;
        maxGlobal: number;
        maxPerKey: number;
        leaseMs: number;
      };
    }
  | {
      action: 'dual.release';
      bucket: string;
      canonicalBucket: LimiterBucket;
      key: string;
      now: number;
      config: {
        bucket: LimiterBucket;
        maxGlobal: number;
        maxPerKey: number;
        leaseMs: number;
      };
    };

function cloneRecord(
  record: RateLimitStateRecord | null
): RateLimitStateRecord | null {
  return record ? { ...record } : null;
}

function createDurableObjectRateLimitStore(
  storage: DurableObjectStorageLike
): RateLimitStore {
  return {
    async withLock(bucket, _scopeKeys, fn) {
      const loaded = new Map<string, RateLimitStateRecord | null>();
      const pendingSets = new Map<string, RateLimitStateRecord>();
      const pendingDeletes = new Set<string>();
      let expireBeforeOrAt: number | null = null;

      function markDeleted(scopeKey: string) {
        pendingSets.delete(scopeKey);
        pendingDeletes.add(scopeKey);
        loaded.set(scopeKey, null);
      }

      function maybeExpireRecord(
        scopeKey: string,
        record: RateLimitStateRecord | null
      ) {
        if (!record || expireBeforeOrAt === null) {
          return record;
        }

        if (record.expiresAt > expireBeforeOrAt) {
          return record;
        }

        markDeleted(scopeKey);
        return null;
      }

      async function readRecord(scopeKey: string) {
        if (pendingDeletes.has(scopeKey)) {
          return null;
        }

        if (pendingSets.has(scopeKey)) {
          return cloneRecord(
            maybeExpireRecord(scopeKey, pendingSets.get(scopeKey) || null)
          );
        }

        if (loaded.has(scopeKey)) {
          return cloneRecord(
            maybeExpireRecord(scopeKey, loaded.get(scopeKey) || null)
          );
        }

        const record = maybeExpireRecord(
          scopeKey,
          (await storage.get<RateLimitStateRecord>(scopeKey)) || null
        );
        loaded.set(scopeKey, cloneRecord(record));
        return cloneRecord(record);
      }

      const lockedStore: LockedRateLimitStore = {
        async get(scopeKey) {
          return await readRecord(scopeKey);
        },

        async getMany(scopeKeys) {
          const result = new Map<string, RateLimitStateRecord>();
          for (const scopeKey of [...new Set(scopeKeys)].sort()) {
            const record = await readRecord(scopeKey);
            if (record) {
              result.set(scopeKey, record);
            }
          }
          return result;
        },

        async set(record) {
          const nextRecord = {
            ...record,
            bucket,
          };
          pendingDeletes.delete(record.scopeKey);
          pendingSets.set(record.scopeKey, nextRecord);
          loaded.set(record.scopeKey, cloneRecord(nextRecord));
        },

        async delete(scopeKey) {
          markDeleted(scopeKey);
        },

        async deleteExpired(now) {
          expireBeforeOrAt = now;

          for (const scopeKey of loaded.keys()) {
            maybeExpireRecord(scopeKey, loaded.get(scopeKey) || null);
          }

          for (const scopeKey of pendingSets.keys()) {
            maybeExpireRecord(scopeKey, pendingSets.get(scopeKey) || null);
          }
        },
      };

      const result = await fn(lockedStore);

      if (pendingDeletes.size > 0) {
        await storage.delete([...pendingDeletes]);
      }

      for (const [scopeKey, record] of pendingSets.entries()) {
        await storage.put(scopeKey, record);
      }

      return result;
    },
  };
}

function json(data: unknown, status = 200) {
  return Response.json(data, { status });
}

export class StatefulLimitersDurableObject {
  private readonly store: RateLimitStore;

  constructor(state: DurableObjectStateLike, _env: unknown) {
    this.store = createDurableObjectRateLimitStore(state.storage);
  }

  async fetch(request: Request) {
    if (request.method !== 'POST') {
      return json({ message: 'method not allowed' }, 405);
    }

    const body = (await request.json()) as DurableObjectRequestBody;

    switch (body.action) {
      case 'cooldown.check': {
        const limiter = new CooldownLimiter({
          ...body.config,
          bucket: body.canonicalBucket,
          store: this.store,
        });
        return json(await limiter.check(body.key, body.now));
      }
      case 'cooldown.checkAndConsume': {
        const limiter = new CooldownLimiter({
          ...body.config,
          bucket: body.canonicalBucket,
          store: this.store,
        });
        return json(await limiter.checkAndConsume(body.key, body.now));
      }
      case 'cooldown.consume': {
        const limiter = new CooldownLimiter({
          ...body.config,
          bucket: body.canonicalBucket,
          store: this.store,
        });
        return json(await limiter.consume(body.key, body.now));
      }
      case 'cooldown.rollback': {
        const limiter = new CooldownLimiter({
          ...body.config,
          bucket: body.canonicalBucket,
          store: this.store,
        });
        await limiter.rollback(body.key, body.consumedAt);
        return json({ ok: true });
      }
      case 'cooldown.clear': {
        const limiter = new CooldownLimiter({
          ...body.config,
          bucket: body.canonicalBucket,
          store: this.store,
        });
        await limiter.clear(body.key);
        return json({ ok: true });
      }
      case 'attempt.check': {
        const limiter = new FixedWindowAttemptLimiter({
          ...body.config,
          bucket: body.canonicalBucket,
          store: this.store,
        });
        return json(await limiter.check(body.key, body.now));
      }
      case 'attempt.recordFailure': {
        const limiter = new FixedWindowAttemptLimiter({
          ...body.config,
          bucket: body.canonicalBucket,
          store: this.store,
        });
        return json(await limiter.recordFailure(body.key, body.now));
      }
      case 'attempt.clear': {
        const limiter = new FixedWindowAttemptLimiter({
          ...body.config,
          bucket: body.canonicalBucket,
          store: this.store,
        });
        await limiter.clear(body.key);
        return json({ ok: true });
      }
      case 'quota.acquire': {
        const limiter = new FixedWindowQuotaLimiter({
          ...body.config,
          bucket: body.canonicalBucket,
          store: this.store,
        });
        return json(await limiter.acquire(body.key, body.now));
      }
      case 'quota.release': {
        const limiter = new FixedWindowQuotaLimiter({
          ...body.config,
          bucket: body.canonicalBucket,
          store: this.store,
        });
        await limiter.release(body.key, body.now);
        return json({ ok: true });
      }
      case 'quota.clear': {
        const limiter = new FixedWindowQuotaLimiter({
          ...body.config,
          bucket: body.canonicalBucket,
          store: this.store,
        });
        await limiter.clear(body.key);
        return json({ ok: true });
      }
      case 'dual.acquire': {
        const limiter = new DualConcurrencyLimiter({
          ...body.config,
          bucket: body.canonicalBucket,
          store: this.store,
        });
        return json(await limiter.acquire(body.key, body.now));
      }
      case 'dual.release': {
        const limiter = new DualConcurrencyLimiter({
          ...body.config,
          bucket: body.canonicalBucket,
          store: this.store,
        });
        await limiter.release(body.key, body.now);
        return json({ ok: true });
      }
      default:
        return json({ message: 'unknown action' }, 400);
    }
  }
}
