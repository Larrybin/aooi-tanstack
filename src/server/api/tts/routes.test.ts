import assert from 'node:assert/strict';
import test from 'node:test';
import type { TextToSpeechGenerationRecord } from '@/domains/text-to-speech-generator/domain/history';

import {
  createTextToSpeechRoutes,
  type TextToSpeechRoutesDeps,
  type TextToSpeechRouteTestActor,
  type TextToSpeechRouteTestStorage,
} from './routes-core';

const anonymousActor = {
  kind: 'anonymous',
  anonymousSessionId: 'anon_1',
  productAccess: {
    productId: 'free',
    entitlements: {
      history_items: 3,
      retention_days: 3,
    },
    entitlementGrantIds: [],
  },
} satisfies TextToSpeechRouteTestActor;

const userActor = {
  kind: 'user',
  userId: 'user_1',
  anonymousSessionId: 'anon_1',
  productAccess: {
    productId: 'free',
    entitlements: {
      history_items: 3,
      retention_days: 3,
    },
    entitlementGrantIds: [],
  },
} satisfies TextToSpeechRouteTestActor;

function createStorage(
  overrides: Partial<TextToSpeechRouteTestStorage> = {}
): TextToSpeechRouteTestStorage {
  return {
    deleteFiles: async () => undefined,
    getFile: async () => null,
    uploadFile: async (options) => ({
      success: true,
      provider: 'test',
      key: options.key,
      url: `https://cdn.example.com/${options.key}`,
      location: `https://cdn.example.com/${options.key}`,
    }),
    ...overrides,
  } as TextToSpeechRouteTestStorage;
}

function createGeneration(
  overrides: Partial<TextToSpeechGenerationRecord> = {}
): TextToSpeechGenerationRecord {
  return {
    anonymousSessionId: null,
    byteSize: 2,
    characterCount: 12,
    chargedCharacters: 0,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    creditId: null,
    deletedAt: null,
    expiresAt: new Date('2027-01-01T00:00:00Z'),
    extraCreditCharacters: 0,
    id: 'generation_1',
    language: 'en',
    mimeType: 'audio/mpeg',
    model: '@cf/deepgram/aura-1',
    monthlyQuotaCharacters: 0,
    outputFormat: 'mp3',
    quotaReservationId: null,
    requestHash: 'hash_1',
    status: 'generated',
    storageKey: 'text-to-speech-generator/en/generation_1.mp3',
    textPreview: 'Hello world',
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    userId: 'user_1',
    voice: 'aura-luna-en',
    ...overrides,
  };
}

function createDeps(
  overrides: Partial<TextToSpeechRoutesDeps> = {}
): TextToSpeechRoutesDeps {
  return {
    commitMonthlyQuota: async () => undefined,
    consumeCredits: async () => ({ id: 'credit_1' }),
    countMonthlyQuotaUnits: async () => 0,
    createApiContext: () => ({
      log: {
        debug: () => undefined,
        error: () => undefined,
        info: () => undefined,
        warn: () => undefined,
      },
      parseJson: async () => {
        throw new Error('parseJson should not be called');
      },
    }),
    createGeneration: async () => createGeneration(),
    deleteOverflowGenerations: async () => [],
    findGenerationById: async () => undefined,
    findReusableGeneration: async () => undefined,
    getRemainingCredits: async () => 0,
    getStorageService: async () => createStorage() as never,
    listGenerations: async () => [],
    markGenerationDeleted: async () => undefined,
    provider: {
      synthesize: async () => ({
        audioBase64: Buffer.from('audio').toString('base64'),
        contentType: 'audio/mpeg',
      }),
    },
    refundConsumedCredit: async () => undefined,
    refundMonthlyQuota: async () => undefined,
    requireSite: () => undefined,
    reserveMonthlyQuota: async () => ({
      reservation: { id: 'quota_1' },
      reused: false,
    }),
    resolveActor: async () => anonymousActor,
    ...overrides,
  };
}

test('TTS history route forwards anonymous Set-Cookie headers', async () => {
  let owner: {
    userId: string | null;
    anonymousSessionId: string | null;
    limit: number;
  } | null = null;
  const { getTextToSpeechHistory } = createTextToSpeechRoutes(
    createDeps({
      listGenerations: async (input) => {
        owner = input;
        return [];
      },
      resolveActor: async (_req, sink) => {
        sink?.appendSetCookie('tts_anon=1; Path=/; HttpOnly');
        return anonymousActor;
      },
    })
  );

  const response = await getTextToSpeechHistory(
    new Request('https://example.com/api/tts/history')
  );

  assert.equal(response.status, 200);
  assert.deepEqual(owner, {
    userId: null,
    anonymousSessionId: 'anon_1',
    limit: 3,
  });
  assert.equal(
    response.headers.get('set-cookie'),
    'tts_anon=1; Path=/; HttpOnly'
  );
});

test('TTS download route forwards id params and returns an attachment', async () => {
  let forwardedId = '';
  let requestedStorageKey = '';
  const { getTextToSpeechDownload } = createTextToSpeechRoutes(
    createDeps({
      findGenerationById: async (id) => {
        forwardedId = id;
        return createGeneration({
          id,
          storageKey: `text-to-speech-generator/en/${id}.mp3`,
          userId: 'user_1',
        });
      },
      getStorageService: async () =>
        createStorage({
          getFile: async (storageKey) => {
            requestedStorageKey = storageKey;
            return {
              body: new ReadableStream<Uint8Array>({
                start(controller) {
                  controller.enqueue(new Uint8Array([1, 2]));
                  controller.close();
                },
              }),
              contentLength: 2,
              contentType: 'audio/mpeg',
            };
          },
        }) as never,
      resolveActor: async (_req, sink) => {
        sink?.appendSetCookie('tts_anon=1; Path=/; HttpOnly');
        return userActor;
      },
    })
  );

  const response = await getTextToSpeechDownload(
    new Request('https://example.com/api/tts/download/generation_9'),
    { params: { id: 'generation_9' } }
  );

  assert.equal(response.status, 200);
  assert.equal(forwardedId, 'generation_9');
  assert.equal(
    requestedStorageKey,
    'text-to-speech-generator/en/generation_9.mp3'
  );
  assert.equal(response.headers.get('content-type'), 'audio/mpeg');
  assert.equal(response.headers.get('content-length'), '2');
  assert.equal(
    response.headers.get('set-cookie'),
    'tts_anon=1; Path=/; HttpOnly'
  );
  assert.match(
    response.headers.get('content-disposition') || '',
    /^attachment; filename="text-to-speech-generation_9\.mp3"$/
  );
});
