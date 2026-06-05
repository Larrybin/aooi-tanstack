import assert from 'node:assert/strict';
import test from 'node:test';
import type { z } from 'zod';

import { createTextToSpeechGeneratePostAction } from './action';

function createAction() {
  return createTextToSpeechGeneratePostAction({
    createApiContext: (req) => ({
      parseJson: async <TSchema extends z.ZodTypeAny>(schema: TSchema) =>
        schema.parse(await req.json()) as z.infer<TSchema>,
      log: {
        debug: () => undefined,
        info: () => undefined,
        warn: () => undefined,
        error: () => undefined,
      },
    }),
    resolveActor: async () => ({
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
    }),
    provider: {
      async synthesize() {
        return {
          audioBase64: Buffer.from('audio').toString('base64'),
          contentType: 'audio/mpeg',
        };
      },
    },
    getStorageService: async () => ({
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
      async deleteFiles() {
        return undefined;
      },
    }),
    async findReusableGeneration() {
      return undefined;
    },
    async createGeneration(input) {
      return {
        ...input,
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-01T00:00:00Z'),
        deletedAt: null,
      };
    },
    async deleteOverflowGenerations() {
      return [];
    },
  });
}

test('tts/generate returns generated preview audio envelope', async () => {
  const action = createAction();
  const response = await action(
    new Request('http://localhost/api/tts/generate', {
      method: 'POST',
      body: JSON.stringify({
        text: 'Hello world',
        language: 'en',
        voice: 'aura-luna-en',
      }),
    })
  );

  assert.equal(response.status, 200);
  const body = (await response.json()) as {
    code: number;
    data: {
      audio: { contentType: string; audioBase64: string };
      generation: { textPreview: string };
    };
  };
  assert.equal(body.code, 0);
  assert.equal(body.data.audio.contentType, 'audio/mpeg');
  assert.equal(
    body.data.audio.audioBase64,
    Buffer.from('audio').toString('base64')
  );
  assert.equal(body.data.generation.textPreview, 'Hello world');
});

test('tts/generate rejects blocked content as a bad request', async () => {
  const action = createAction();
  await assert.rejects(
    action(
      new Request('http://localhost/api/tts/generate', {
        method: 'POST',
        body: JSON.stringify({
          text: 'phishing scam',
          language: 'en',
          voice: 'aura-luna-en',
        }),
      })
    ),
    { name: 'BadRequestError' }
  );
});
