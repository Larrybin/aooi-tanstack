import assert from 'node:assert/strict';
import test from 'node:test';

import { FixedWindowQuotaLimiter } from '@/shared/lib/api/limiters';
import { LimiterBucket } from '@/shared/lib/api/limiters-config';
import { createMemoryRateLimitStore } from '@/shared/lib/api/rate-limit-store';

import {
  buildTextToSpeechTurnstileTrustCookie,
  createTextToSpeechTurnstileTrustCookie,
  readAndConsumeTextToSpeechTurnstileTrust,
  readTextToSpeechTurnstileTrustCookie,
  resetTextToSpeechTurnstileTrust,
  TEXT_TO_SPEECH_TURNSTILE_TRUST_COOKIE,
} from './turnstile-trust';

function request(cookie?: string) {
  return new Request('https://example.com/api/tts/generate', {
    headers: cookie ? { cookie } : undefined,
  });
}

test('readTextToSpeechTurnstileTrustCookie accepts only valid signed same-session cookies', async () => {
  const cookieValue = await buildTextToSpeechTurnstileTrustCookie({
    anonymousSessionId: 'anon_12345678',
    expiresAt: 1_800_000,
    secret: 'turnstile-secret',
  });

  const trust = await readTextToSpeechTurnstileTrustCookie({
    req: request(
      `${TEXT_TO_SPEECH_TURNSTILE_TRUST_COOKIE}=${encodeURIComponent(cookieValue)}`
    ),
    anonymousSessionId: 'anon_12345678',
    secret: 'turnstile-secret',
    now: () => 1_000,
  });

  assert.deepEqual(trust, {
    anonymousSessionId: 'anon_12345678',
    expiresAt: 1_800_000,
  });
  assert.equal(
    await readTextToSpeechTurnstileTrustCookie({
      req: request(
        `${TEXT_TO_SPEECH_TURNSTILE_TRUST_COOKIE}=${encodeURIComponent(cookieValue)}`
      ),
      anonymousSessionId: 'anon_other123',
      secret: 'turnstile-secret',
      now: () => 1_000,
    }),
    null
  );
});

test('readAndConsumeTextToSpeechTurnstileTrust consumes server-side anonymous generations', async () => {
  const limiter = new FixedWindowQuotaLimiter({
    bucket: LimiterBucket.API_TTS_TURNSTILE_TRUST,
    windowMs: 30 * 60 * 1000,
    maxAttempts: 3,
    maxConcurrent: 3,
    store: createMemoryRateLimitStore(),
  });
  const cookieValue = await buildTextToSpeechTurnstileTrustCookie({
    anonymousSessionId: 'anon_12345678',
    expiresAt: 1_800_000,
    secret: 'turnstile-secret',
  });
  const trustedRequest = request(
    `${TEXT_TO_SPEECH_TURNSTILE_TRUST_COOKIE}=${encodeURIComponent(cookieValue)}`
  );

  for (let index = 0; index < 3; index += 1) {
    assert.equal(
      await readAndConsumeTextToSpeechTurnstileTrust({
        req: trustedRequest,
        anonymousSessionId: 'anon_12345678',
        secret: 'turnstile-secret',
        now: () => 1_000,
        limiter,
      }),
      true
    );
  }
  assert.equal(
    await readAndConsumeTextToSpeechTurnstileTrust({
      req: trustedRequest,
      anonymousSessionId: 'anon_12345678',
      secret: 'turnstile-secret',
      now: () => 1_000,
      limiter,
    }),
    false
  );
});

test('createTextToSpeechTurnstileTrustCookie stores only the same-session trust window', async () => {
  const setCookie = await createTextToSpeechTurnstileTrustCookie({
    req: request(),
    anonymousSessionId: 'anon_12345678',
    secret: 'turnstile-secret',
    now: () => 1_000,
  });

  assert.match(
    setCookie,
    /^tts_turnstile=anon_12345678\.1801000\.[a-f0-9]{64}; Path=\/; Max-Age=1800; HttpOnly; SameSite=Lax; Secure$/
  );
});

test('resetTextToSpeechTurnstileTrust counts the verified generation in the server-side window', async () => {
  const limiter = new FixedWindowQuotaLimiter({
    bucket: LimiterBucket.API_TTS_TURNSTILE_TRUST,
    windowMs: 30 * 60 * 1000,
    maxAttempts: 3,
    maxConcurrent: 3,
    store: createMemoryRateLimitStore(),
  });
  const cookieValue = await buildTextToSpeechTurnstileTrustCookie({
    anonymousSessionId: 'anon_12345678',
    expiresAt: 1_800_000,
    secret: 'turnstile-secret',
  });
  const trustedRequest = request(
    `${TEXT_TO_SPEECH_TURNSTILE_TRUST_COOKIE}=${encodeURIComponent(cookieValue)}`
  );

  assert.equal(
    await resetTextToSpeechTurnstileTrust({
      limiter,
      anonymousSessionId: 'anon_12345678',
    }),
    true
  );
  assert.equal(
    await readAndConsumeTextToSpeechTurnstileTrust({
      req: trustedRequest,
      anonymousSessionId: 'anon_12345678',
      secret: 'turnstile-secret',
      now: () => 1_000,
      limiter,
    }),
    true
  );
  assert.equal(
    await readAndConsumeTextToSpeechTurnstileTrust({
      req: trustedRequest,
      anonymousSessionId: 'anon_12345678',
      secret: 'turnstile-secret',
      now: () => 1_000,
      limiter,
    }),
    true
  );
  assert.equal(
    await readAndConsumeTextToSpeechTurnstileTrust({
      req: trustedRequest,
      anonymousSessionId: 'anon_12345678',
      secret: 'turnstile-secret',
      now: () => 1_000,
      limiter,
    }),
    false
  );
});
