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

function chargeDeps(
  overrides: Partial<
    Parameters<typeof generateStoredTextToSpeechPreview>[0]['deps']
  > = {}
) {
  return {
    async countMonthlyQuotaUnits() {
      return 0;
    },
    async reserveMonthlyQuota() {
      return { reservation: { id: 'quota_1' } };
    },
    async commitMonthlyQuota() {
      return undefined;
    },
    async refundMonthlyQuota() {
      return undefined;
    },
    async consumeCredits() {
      return { id: 'credit_1' };
    },
    async refundConsumedCredit() {
      return undefined;
    },
    ...overrides,
  };
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
      ...chargeDeps(),
    },
  });

  assert.equal(result.generation?.id, 'tts_1');
  assert.equal(generations[0]?.textPreview, 'a'.repeat(100));
  assert.equal(
    generations[0]?.storageKey,
    'text-to-speech-generator/en/tts_1.mp3'
  );
  assert.equal(generations[0]?.byteSize, 5);
  assert.equal(generations[0]?.chargedCharacters, 120);
  assert.equal(generations[0]?.monthlyQuotaCharacters, 120);
  assert.equal(generations[0]?.extraCreditCharacters, 0);
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
    quotaReservationId: null,
    creditId: null,
    chargedCharacters: 0,
    monthlyQuotaCharacters: 0,
    extraCreditCharacters: 0,
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
      ...chargeDeps({
        async reserveMonthlyQuota() {
          throw new Error('quota should not be reserved on reuse');
        },
        async consumeCredits() {
          throw new Error('credits should not be consumed on reuse');
        },
      }),
    },
  });

  assert.equal(providerCalls, 0);
  assert.equal(result.generation?.reused, true);
  assert.equal(
    result.audio.audioBase64,
    Buffer.from('audio').toString('base64')
  );
});

test('generateStoredTextToSpeechPreview consumes extra credits only after monthly quota is exhausted', async () => {
  let reservedUnits = 0;
  let consumedCredits = 0;
  const result = await generateStoredTextToSpeechPreview({
    actor: {
      ...actor,
      entitlements: {
        monthly_characters: 100,
        single_request_characters: 3500,
        history_items: 3,
        retention_days: 3,
      },
    },
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
        return {
          ...input,
          createdAt: new Date('2026-01-01T00:00:00Z'),
          updatedAt: new Date('2026-01-01T00:00:00Z'),
          deletedAt: null,
        } satisfies TextToSpeechGenerationRecord;
      },
      async deleteOverflowGenerations() {
        return [];
      },
      ...chargeDeps({
        async countMonthlyQuotaUnits() {
          return 80;
        },
        async reserveMonthlyQuota(input) {
          reservedUnits = input.units;
          return { reservation: { id: 'quota_1' } };
        },
        async consumeCredits(input) {
          consumedCredits = input.credits;
          return { id: 'credit_1' };
        },
      }),
    },
  });

  assert.equal(reservedUnits, 20);
  assert.equal(consumedCredits, 100);
  assert.equal(result.generation?.id, 'tts_1');
});

test('generateStoredTextToSpeechPreview refunds quota and credits when synthesis fails', async () => {
  const events: string[] = [];

  await assert.rejects(
    generateStoredTextToSpeechPreview({
      actor: {
        ...actor,
        entitlements: {
          monthly_characters: 100,
          single_request_characters: 3500,
          history_items: 3,
          retention_days: 3,
        },
      },
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
            throw new Error('provider failed');
          },
        },
        async getStorageService() {
          return {
            async uploadFile() {
              throw new Error('upload should not run');
            },
            async getFile() {
              return null;
            },
          };
        },
        async findReusableGeneration() {
          return undefined;
        },
        async createGeneration() {
          throw new Error('create should not run');
        },
        async deleteOverflowGenerations() {
          return [];
        },
        ...chargeDeps({
          async countMonthlyQuotaUnits() {
            return 80;
          },
          async reserveMonthlyQuota() {
            events.push('reserve-quota');
            return { reservation: { id: 'quota_1' } };
          },
          async consumeCredits() {
            events.push('consume-credit');
            return { id: 'credit_1' };
          },
          async refundMonthlyQuota(input) {
            events.push(`refund-quota:${input.reservationId}`);
            return undefined;
          },
          async refundConsumedCredit(creditId) {
            events.push(`refund-credit:${creditId}`);
            return undefined;
          },
        }),
      },
    }),
    /provider failed/
  );

  assert.deepEqual(events, [
    'reserve-quota',
    'consume-credit',
    'refund-quota:quota_1',
    'refund-credit:credit_1',
  ]);
});
