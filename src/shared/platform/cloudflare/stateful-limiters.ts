import { getCloudflareBindings } from '@/infra/runtime/env.server';
import { site } from '@/site';

import type {
  AllowedLimitResult,
  DeniedLimitResult,
  LimitResult,
} from '@/shared/lib/api/limiters';
import type { LimiterBucket } from '@/shared/lib/api/limiters-config';

type CooldownConfig = {
  bucket: LimiterBucket;
  minIntervalMs: number;
  ttlMs: number;
};

type AttemptConfig = {
  bucket: LimiterBucket;
  windowMs: number;
  maxAttempts: number;
};

type QuotaConfig = {
  bucket: LimiterBucket;
  windowMs: number;
  maxAttempts: number;
  maxConcurrent: number;
};

type DualConfig = {
  bucket: LimiterBucket;
  maxGlobal: number;
  maxPerKey: number;
  leaseMs: number;
};

type StatefulLimiterNamespace = Pick<
  DurableObjectNamespace,
  'idFromName' | 'get'
>;

const BUCKET_SCOPED_OBJECT_PREFIX = 'bucket';
const KEY_SCOPED_OBJECT_PREFIX = 'scope';

export function buildSiteScopedLimiterBucket(bucket: LimiterBucket): string {
  return `${site.key}:${bucket}`;
}

export function buildStatefulLimiterObjectName(
  bucket: LimiterBucket,
  key?: string
): string {
  const siteScopedBucket = buildSiteScopedLimiterBucket(bucket);
  return key
    ? `${KEY_SCOPED_OBJECT_PREFIX}:${siteScopedBucket}:${key}`
    : `${BUCKET_SCOPED_OBJECT_PREFIX}:${siteScopedBucket}`;
}

async function callStatefulLimiter<T>(
  bucket: LimiterBucket,
  body: Record<string, unknown>,
  options: {
    key?: string;
    namespace?: StatefulLimiterNamespace;
  } = {}
): Promise<T> {
  const namespace =
    options.namespace ??
    (getCloudflareBindings()?.STATEFUL_LIMITERS as
      | StatefulLimiterNamespace
      | undefined);
  if (!namespace) {
    throw new Error('STATEFUL_LIMITERS binding is missing');
  }

  const id = namespace.idFromName(
    buildStatefulLimiterObjectName(bucket, options.key)
  );
  const stub = namespace.get(id);
  const response = await stub.fetch('https://stateful-limiters.internal', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      bucket: buildSiteScopedLimiterBucket(bucket),
      canonicalBucket: bucket,
      ...body,
    }),
  });

  if (!response.ok) {
    throw new Error(
      `stateful limiter request failed (${response.status} ${response.statusText})`
    );
  }

  return (await response.json()) as T;
}

export class CloudflareCooldownLimiter {
  constructor(
    private readonly config: CooldownConfig,
    private readonly now: () => number = Date.now,
    private readonly namespace?: StatefulLimiterNamespace
  ) {}

  async check(key: string, now = this.now()): Promise<LimitResult> {
    return await callStatefulLimiter<LimitResult>(
      this.config.bucket,
      {
        action: 'cooldown.check',
        key,
        now,
        config: this.config,
      },
      { key, namespace: this.namespace }
    );
  }

  async checkAndConsume(key: string, now = this.now()): Promise<LimitResult> {
    return await callStatefulLimiter<LimitResult>(
      this.config.bucket,
      {
        action: 'cooldown.checkAndConsume',
        key,
        now,
        config: this.config,
      },
      { key, namespace: this.namespace }
    );
  }

  async consume(key: string, now = this.now()): Promise<number> {
    return await callStatefulLimiter<number>(
      this.config.bucket,
      {
        action: 'cooldown.consume',
        key,
        now,
        config: this.config,
      },
      { key, namespace: this.namespace }
    );
  }

  async rollback(key: string, consumedAt: number): Promise<void> {
    await callStatefulLimiter(
      this.config.bucket,
      {
        action: 'cooldown.rollback',
        key,
        consumedAt,
        config: this.config,
      },
      { key, namespace: this.namespace }
    );
  }

  async clear(key: string): Promise<void> {
    await callStatefulLimiter(
      this.config.bucket,
      {
        action: 'cooldown.clear',
        key,
        config: this.config,
      },
      { key, namespace: this.namespace }
    );
  }
}

export class CloudflareAttemptLimiter {
  constructor(
    private readonly config: AttemptConfig,
    private readonly now: () => number = Date.now,
    private readonly namespace?: StatefulLimiterNamespace
  ) {}

  async check(key: string, now = this.now()): Promise<LimitResult> {
    return await callStatefulLimiter<LimitResult>(
      this.config.bucket,
      {
        action: 'attempt.check',
        key,
        now,
        config: this.config,
      },
      { key, namespace: this.namespace }
    );
  }

  async recordFailure(
    key: string,
    now = this.now()
  ): Promise<{ attempts: number; retryAfterSeconds?: number }> {
    return await callStatefulLimiter(
      this.config.bucket,
      {
        action: 'attempt.recordFailure',
        key,
        now,
        config: this.config,
      },
      { key, namespace: this.namespace }
    );
  }

  async clear(key: string): Promise<void> {
    await callStatefulLimiter(
      this.config.bucket,
      {
        action: 'attempt.clear',
        key,
        config: this.config,
      },
      { key, namespace: this.namespace }
    );
  }
}

export class CloudflareQuotaLimiter {
  constructor(
    private readonly config: QuotaConfig,
    private readonly now: () => number = Date.now,
    private readonly namespace?: StatefulLimiterNamespace
  ) {}

  async acquire(
    key: string,
    now = this.now()
  ): Promise<AllowedLimitResult | DeniedLimitResult> {
    return await callStatefulLimiter(
      this.config.bucket,
      {
        action: 'quota.acquire',
        key,
        now,
        config: this.config,
      },
      { key, namespace: this.namespace }
    );
  }

  async release(key: string, now = this.now()): Promise<void> {
    await callStatefulLimiter(
      this.config.bucket,
      {
        action: 'quota.release',
        key,
        now,
        config: this.config,
      },
      { key, namespace: this.namespace }
    );
  }

  async clear(key: string): Promise<void> {
    await callStatefulLimiter(
      this.config.bucket,
      {
        action: 'quota.clear',
        key,
        config: this.config,
      },
      { key, namespace: this.namespace }
    );
  }
}

export class CloudflareDualConcurrencyLimiter {
  constructor(
    private readonly config: DualConfig,
    private readonly now: () => number = Date.now,
    private readonly namespace?: StatefulLimiterNamespace
  ) {}

  async acquire(key: string, now = this.now()): Promise<boolean> {
    return await callStatefulLimiter(
      this.config.bucket,
      {
        action: 'dual.acquire',
        key,
        now,
        config: this.config,
      },
      { namespace: this.namespace }
    );
  }

  async release(key: string, now = this.now()): Promise<void> {
    await callStatefulLimiter(
      this.config.bucket,
      {
        action: 'dual.release',
        key,
        now,
        config: this.config,
      },
      { namespace: this.namespace }
    );
  }
}
