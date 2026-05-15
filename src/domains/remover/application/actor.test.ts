import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildAnonymousSessionCookie,
  readAnonymousSessionIdFromRequest,
  REMOVER_ANONYMOUS_SESSION_COOKIE,
  resolveAnonymousSessionForRequest,
  resolveAnonymousSessionIdForRequest,
} from './actor-session';

function request(headers: HeadersInit) {
  return new Request('https://example.com/api/remover/upload', { headers });
}

test('resolveAnonymousSessionIdForRequest ignores client-rotated remover session headers', async () => {
  const cookieValue = await buildAnonymousSessionCookie({
    anonymousSessionId: 'anon_cookie_123',
    secret: 'test-secret',
  });
  const first = await resolveAnonymousSessionIdForRequest(
    request({
      cookie: `${REMOVER_ANONYMOUS_SESSION_COOKIE}=${cookieValue}`,
      'cf-connecting-ip': '203.0.113.10',
      'user-agent': 'Mozilla/5.0',
      'x-remover-session-id': 'client-one',
    }),
    { secret: 'test-secret' }
  );
  const second = await resolveAnonymousSessionIdForRequest(
    request({
      cookie: `${REMOVER_ANONYMOUS_SESSION_COOKIE}=${cookieValue}`,
      'cf-connecting-ip': '203.0.113.10',
      'user-agent': 'Mozilla/5.0',
      'x-remover-session-id': 'client-two',
    }),
    { secret: 'test-secret' }
  );

  assert.equal(first, second);
  assert.equal(first, 'anon_cookie_123');
});

test('resolveAnonymousSessionForRequest creates a signed cookie-backed anonymous owner', async () => {
  const result = await resolveAnonymousSessionForRequest(request({}), {
    secret: 'test-secret',
    createId: () => 'anon_created_123',
  });

  assert.equal(result.anonymousSessionId, 'anon_created_123');
  assert.equal(result.shouldSetCookie, true);
  assert.match(result.cookieValue, /^anon_created_123\.[a-f0-9]{64}$/);
});

test('resolveAnonymousSessionForRequest reuses a valid signed anonymous owner cookie', async () => {
  const cookieValue = await buildAnonymousSessionCookie({
    anonymousSessionId: 'anon_cookie_123',
    secret: 'test-secret',
  });
  const result = await resolveAnonymousSessionForRequest(
    request({
      cookie: `${REMOVER_ANONYMOUS_SESSION_COOKIE}=${cookieValue}`,
      'cf-connecting-ip': '203.0.113.10',
      'user-agent': 'Mozilla/5.0',
    }),
    {
      secret: 'test-secret',
      createId: () => 'anon_new_123',
    }
  );

  assert.equal(result.anonymousSessionId, 'anon_cookie_123');
  assert.equal(result.shouldSetCookie, false);
});

test('readAnonymousSessionIdFromRequest returns only a valid signed anonymous owner cookie', async () => {
  const cookieValue = await buildAnonymousSessionCookie({
    anonymousSessionId: 'anon_cookie_123',
    secret: 'test-secret',
  });

  assert.equal(
    await readAnonymousSessionIdFromRequest(
      request({
        cookie: `${REMOVER_ANONYMOUS_SESSION_COOKIE}=${cookieValue}`,
      }),
      { secret: 'test-secret' }
    ),
    'anon_cookie_123'
  );
  assert.equal(
    await readAnonymousSessionIdFromRequest(
      request({
        cookie: `${REMOVER_ANONYMOUS_SESSION_COOKIE}=anon_cookie_123.bad`,
      }),
      { secret: 'test-secret' }
    ),
    null
  );
});

test('resolveAnonymousSessionForRequest does not derive ownership from shared IP and user-agent', async () => {
  const first = await resolveAnonymousSessionIdForRequest(
    request({
      'cf-connecting-ip': '203.0.113.10',
      'user-agent': 'Mozilla/5.0',
    }),
    {
      secret: 'test-secret',
      createId: () => 'anon_first_123',
    }
  );
  const second = await resolveAnonymousSessionIdForRequest(
    request({
      'cf-connecting-ip': '203.0.113.10',
      'user-agent': 'Mozilla/5.0',
    }),
    {
      secret: 'test-secret',
      createId: () => 'anon_second_123',
    }
  );

  assert.notEqual(first, second);
});
