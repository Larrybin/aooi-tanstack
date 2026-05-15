import assert from 'node:assert/strict';
import test from 'node:test';

import { TooManyRequestsError } from '@/shared/lib/api/errors';

import {
  acquireRemoverGuestIpLimit,
  resolveRemoverGuestIp,
} from './guest-ip-limit';

test('resolveRemoverGuestIp prefers Cloudflare IP and falls back to forwarded IP', () => {
  assert.equal(
    resolveRemoverGuestIp(
      new Request('https://example.com', {
        headers: {
          'cf-connecting-ip': '203.0.113.10',
          'x-forwarded-for': '198.51.100.1, 198.51.100.2',
        },
      })
    ),
    '203.0.113.10'
  );
  assert.equal(
    resolveRemoverGuestIp(
      new Request('https://example.com', {
        headers: {
          'x-forwarded-for': '198.51.100.1, 198.51.100.2',
        },
      })
    ),
    '198.51.100.1'
  );
});

test('acquireRemoverGuestIpLimit rejects denied anonymous requests', async () => {
  await assert.rejects(
    () =>
      acquireRemoverGuestIpLimit({
        actor: {
          kind: 'anonymous',
          anonymousSessionId: 'anon_1',
        },
        req: new Request('https://example.com'),
        limiter: {
          acquire: async () => ({ allowed: false, reason: 'rate_limited' }),
          release: async () => undefined,
        },
      }),
    TooManyRequestsError
  );
});

test('acquireRemoverGuestIpLimit skips signed-in users', async () => {
  let called = false;
  const release = await acquireRemoverGuestIpLimit({
    actor: {
      kind: 'user',
      userId: 'user_1',
      anonymousSessionId: 'anon_1',
      productId: 'free',
    },
    req: new Request('https://example.com'),
    limiter: {
      acquire: async () => {
        called = true;
        return { allowed: true };
      },
      release: async () => undefined,
    },
  });

  assert.equal(called, false);
  assert.equal(release, undefined);
});
