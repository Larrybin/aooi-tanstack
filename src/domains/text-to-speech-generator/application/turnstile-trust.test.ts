import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildTextToSpeechTurnstileTrustCookie,
  consumeTextToSpeechTurnstileTrustCookie,
  createTextToSpeechTurnstileTrustCookie,
  readTextToSpeechTurnstileTrustCookie,
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
    remainingGenerations: 2,
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
    remainingGenerations: 2,
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

test('consumeTextToSpeechTurnstileTrustCookie decrements remaining anonymous generations', async () => {
  const setCookie = await consumeTextToSpeechTurnstileTrustCookie({
    req: request(),
    trust: {
      anonymousSessionId: 'anon_12345678',
      remainingGenerations: 2,
      expiresAt: 1_800_000,
    },
    secret: 'turnstile-secret',
    now: () => 1_000,
  });

  assert.match(
    setCookie,
    /^tts_turnstile=anon_12345678\.1\.1800000\.[a-f0-9]{64}; Path=\/; Max-Age=1799; HttpOnly; SameSite=Lax; Secure$/
  );
});

test('createTextToSpeechTurnstileTrustCookie allows two more anonymous generations after validation', async () => {
  const setCookie = await createTextToSpeechTurnstileTrustCookie({
    req: request(),
    anonymousSessionId: 'anon_12345678',
    secret: 'turnstile-secret',
    now: () => 1_000,
  });

  assert.match(
    setCookie,
    /^tts_turnstile=anon_12345678\.2\.1801000\.[a-f0-9]{64}; Path=\/; Max-Age=1800; HttpOnly; SameSite=Lax; Secure$/
  );
});
