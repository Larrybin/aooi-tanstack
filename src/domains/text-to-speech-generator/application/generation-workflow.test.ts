import assert from 'node:assert/strict';
import test from 'node:test';

import type { TextToSpeechGenerationRecord } from '../domain/history';
import type { TextToSpeechActor } from '../domain/types';
import { generateStoredTextToSpeechPreview } from './generation-workflow';

const actor: TextToSpeechActor = {
  kind: 'user',
  userId: 'user_1',
  anonymousSessionId: 'anon_1',
  productId: 'free',
  entitlements: { history_items: 3, retention_days: 3 },
  entitlementGrantIds: [],
};

function streamFromBytes(bytes: Uint8Array) {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
}

test('generateStoredTextToSpeechPreview stores audio and only a 100 character preview', async () => {
  const generations: TextToSpeechGenerationRecord[] = [];
  const result = await generateStoredTextToSpeechPreview({
    actor,
    input: {
      text: 'a'.repeat(120),
      language: 'en',
      voice: 'aura-luna-en',
    },
    deps: {
      now: () => new Date('2026-01-01T00:00:00Z'),
      createId: () => 'tts_1',
      provider: {
        async synthesize() {
          return {
            audioBase64: Buffer.from('audio').toString('base64'),
            contentType: 'audio/mpeg',
          };
        },
      },
      async getStorageService() {
        return {
          async uploadFile(options) {
            return {
              success: true,
              provider: 'test',
              key: options.key,
              url: `https://cdn.example.com/${options.key}`,
            };
          },
          async getFile() {
            return null;
          },
        };
      },
      async findReusableGeneration() {
        return undefined;
      },
      async createGeneration(input) {
        const generation = {
          ...input,
          createdAt: new Date('2026-01-01T00:00:00Z'),
          updatedAt: new Date('2026-01-01T00:00:00Z'),
          deletedAt: null,
        } satisfies TextToSpeechGenerationRecord;
        generations.push(generation);
        return generation;
      },
      async deleteOverflowGenerations() {
        return [];
      },
    },
  });

  assert.equal(result.generation?.id, 'tts_1');
  assert.equal(generations[0]?.textPreview, 'a'.repeat(100));
  assert.equal(
    generations[0]?.storageKey,
    'text-to-speech-generator/en/tts_1.mp3'
  );
  assert.equal(generations[0]?.byteSize, 5);
});

test('generateStoredTextToSpeechPreview reuses matching unexpired audio', async () => {
  let providerCalls = 0;
  const reusable = {
    id: 'tts_reused',
    userId: 'user_1',
    anonymousSessionId: 'anon_1',
    status: 'generated',
    textPreview: 'hello',
    characterCount: 5,
    language: 'en',
    voice: 'aura-luna-en',
    model: '@cf/deepgram/aura-2-en',
    outputFormat: 'mp3',
    requestHash: 'hash',
    storageKey: 'text-to-speech-generator/en/tts_reused.mp3',
    mimeType: 'audio/mpeg',
    byteSize: 5,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    deletedAt: null,
    expiresAt: new Date('2026-01-04T00:00:00Z'),
  } satisfies TextToSpeechGenerationRecord;

  const result = await generateStoredTextToSpeechPreview({
    actor,
    input: {
      text: 'hello',
      language: 'en',
      voice: 'aura-luna-en',
    },
    deps: {
      now: () => new Date('2026-01-01T00:00:00Z'),
      provider: {
        async synthesize() {
          providerCalls += 1;
          return {
            audioBase64: Buffer.from('new-audio').toString('base64'),
            contentType: 'audio/mpeg',
          };
        },
      },
      async getStorageService() {
        return {
          async uploadFile() {
            throw new Error('upload should not run');
          },
          async getFile() {
            return {
              body: streamFromBytes(Buffer.from('audio')),
              contentType: 'audio/mpeg',
              contentLength: 5,
            };
          },
        };
      },
      async findReusableGeneration() {
        return reusable;
      },
      async createGeneration() {
        throw new Error('create should not run');
      },
      async deleteOverflowGenerations() {
        return [];
      },
    },
  });

  assert.equal(providerCalls, 0);
  assert.equal(result.generation?.reused, true);
  assert.equal(
    result.audio.audioBase64,
    Buffer.from('audio').toString('base64')
  );
});
