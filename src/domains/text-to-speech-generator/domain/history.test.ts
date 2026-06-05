import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assertTextToSpeechGenerationDownloadable,
  buildTextToSpeechTextPreview,
  getTextToSpeechHistoryLimit,
} from './history';
import type { TextToSpeechActor } from './types';

const userActor: TextToSpeechActor = {
  kind: 'user',
  userId: 'user_1',
  anonymousSessionId: 'anon_1',
  productId: 'free',
  entitlements: { history_items: 3, retention_days: 3 },
  entitlementGrantIds: [],
};

test('buildTextToSpeechTextPreview keeps only the first 100 characters', () => {
  assert.equal(buildTextToSpeechTextPreview('a'.repeat(120)), 'a'.repeat(100));
});

test('getTextToSpeechHistoryLimit reads plan entitlement with free fallback', () => {
  assert.equal(getTextToSpeechHistoryLimit(userActor), 3);
  assert.equal(
    getTextToSpeechHistoryLimit({
      ...userActor,
      entitlements: { history_items: 50 },
    }),
    50
  );
});

test('assertTextToSpeechGenerationDownloadable rejects expired audio', () => {
  assert.throws(
    () =>
      assertTextToSpeechGenerationDownloadable({
        actor: userActor,
        now: new Date('2026-01-02T00:00:00Z'),
        generation: {
          id: 'tts_1',
          userId: 'user_1',
          anonymousSessionId: null,
          status: 'generated',
          textPreview: 'hello',
          characterCount: 5,
          language: 'en',
          voice: 'aura-luna-en',
          model: '@cf/deepgram/aura-2-en',
          outputFormat: 'mp3',
          requestHash: 'hash',
          storageKey: 'tts/tts_1.mp3',
          mimeType: 'audio/mpeg',
          byteSize: 10,
          createdAt: new Date('2026-01-01T00:00:00Z'),
          updatedAt: new Date('2026-01-01T00:00:00Z'),
          deletedAt: null,
          expiresAt: new Date('2026-01-01T12:00:00Z'),
        },
      }),
    { name: 'NotFoundError' }
  );
});

test('assertTextToSpeechGenerationDownloadable allows same-session guest audio after sign in', () => {
  const generation = assertTextToSpeechGenerationDownloadable({
    actor: userActor,
    now: new Date('2026-01-01T00:00:00Z'),
    generation: {
      id: 'tts_1',
      userId: null,
      anonymousSessionId: 'anon_1',
      status: 'generated',
      textPreview: 'hello',
      characterCount: 5,
      language: 'en',
      voice: 'aura-luna-en',
      model: '@cf/deepgram/aura-2-en',
      outputFormat: 'mp3',
      requestHash: 'hash',
      storageKey: 'tts/tts_1.mp3',
      mimeType: 'audio/mpeg',
      byteSize: 10,
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
      deletedAt: null,
      expiresAt: new Date('2026-01-02T00:00:00Z'),
    },
  });

  assert.equal(generation.id, 'tts_1');
});
