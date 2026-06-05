import assert from 'node:assert/strict';
import test from 'node:test';
import type { z } from 'zod';

import { createTextToSpeechGeneratePostAction } from './action';

function createActionDeps() {
  return {
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
    async markGenerationDeleted() {
      return undefined;
    },
    async deleteOverflowGenerations() {
      return [];
    },
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
  } satisfies Parameters<typeof createTextToSpeechGeneratePostAction>[0];
}

function createAction() {
  return createTextToSpeechGeneratePostAction(createActionDeps());
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

test('tts/generate applies guest IP limiter for anonymous previews', async () => {
  let limitedIp: string | null = null;
  let released = false;
  const action = createTextToSpeechGeneratePostAction({
    ...createActionDeps(),
    acquireGuestIpLimit: async ({ req }) => {
      limitedIp = req.headers.get('cf-connecting-ip');
      return async () => {
        released = true;
      };
    },
  });

  const response = await action(
    new Request('http://localhost/api/tts/generate', {
      method: 'POST',
      headers: { 'cf-connecting-ip': '203.0.113.20' },
      body: JSON.stringify({
        text: 'Hello world',
        language: 'en',
        voice: 'aura-luna-en',
      }),
    })
  );

  assert.equal(response.status, 200);
  assert.equal(limitedIp, '203.0.113.20');
  assert.equal(released, true);
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
