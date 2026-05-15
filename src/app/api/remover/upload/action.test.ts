import assert from 'node:assert/strict';
import test from 'node:test';

import { createRemoverUploadPostAction } from './action';

const pngBytes = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

test('remover upload action returns only a public asset DTO', async () => {
  const formData = new FormData();
  formData.set('kind', 'original');
  formData.set('width', '100');
  formData.set('height', '80');
  const file = new File([pngBytes], 'photo.png', { type: 'image/png' });

  const action = createRemoverUploadPostAction({
    createApiContext: () =>
      ({
        log: {
          info: () => undefined,
        },
      }) as never,
    resolveActor: async () => ({
      kind: 'anonymous',
      anonymousSessionId: 'anon_1',
    }),
    readUploadRequestInput: async () => ({
      formData,
      entries: [file],
      files: [file],
    }),
    getStorageService: async () =>
      ({
        uploadFile: async ({ key }: { key: string }) => ({
          success: true,
          key,
          url: `https://assets.example.com/${key}`,
        }),
        deleteFiles: async () => undefined,
      }) as never,
    detectImageMime: () => 'image/png',
    createAsset: async (asset) => ({
      ...asset,
      createdAt: new Date('2026-05-06T00:00:00Z'),
      updatedAt: new Date('2026-05-06T00:00:00Z'),
      deletedAt: null,
    }),
    reserveUploadQuota: async ({ reservation }) => ({
      reservation: {
        ...reservation,
        jobId: null,
        reason: null,
        createdAt: new Date('2026-05-06T00:00:00Z'),
        updatedAt: new Date('2026-05-06T00:00:00Z'),
        committedAt: null,
        refundedAt: null,
      },
      reused: false,
    }),
    commitReservation: async () => undefined,
    refundReservation: async () => undefined,
  });

  const response = await action(
    new Request('https://example.com/api/remover/upload', { method: 'POST' })
  );
  const body = (await response.json()) as {
    data: {
      asset: Record<string, unknown>;
      anonymousSessionId: string | null;
    };
  };

  assert.equal(response.status, 200);
  assert.deepEqual(Object.keys(body.data.asset).sort(), ['id', 'kind']);
  assert.equal(typeof body.data.asset.id, 'string');
  assert.equal(body.data.asset.kind, 'original');
  assert.equal('url' in body.data.asset, false);
  assert.equal('storageKey' in body.data.asset, false);
});

test('remover upload action applies anonymous guest IP limiter before storage write', async () => {
  const formData = new FormData();
  formData.set('kind', 'original');
  const file = new File([pngBytes], 'photo.png', { type: 'image/png' });
  const events: string[] = [];

  const action = createRemoverUploadPostAction({
    createApiContext: () =>
      ({
        log: {
          info: () => undefined,
        },
      }) as never,
    resolveActor: async () => ({
      kind: 'anonymous',
      anonymousSessionId: 'anon_1',
    }),
    readUploadRequestInput: async () => ({
      formData,
      entries: [file],
      files: [file],
    }),
    getStorageService: async () =>
      ({
        uploadFile: async ({ key }: { key: string }) => {
          events.push('storage');
          return {
            success: true,
            key,
            url: `https://assets.example.com/${key}`,
          };
        },
        deleteFiles: async () => undefined,
      }) as never,
    detectImageMime: () => 'image/png',
    acquireGuestIpLimit: async ({ req }) => {
      events.push(`limit:${req.headers.get('cf-connecting-ip')}`);
      return async () => {
        events.push('release');
      };
    },
    createAsset: async (asset) => ({
      ...asset,
      createdAt: new Date('2026-05-06T00:00:00Z'),
      updatedAt: new Date('2026-05-06T00:00:00Z'),
      deletedAt: null,
    }),
    reserveUploadQuota: async ({ reservation }) => ({
      reservation: {
        ...reservation,
        jobId: null,
        reason: null,
        createdAt: new Date('2026-05-06T00:00:00Z'),
        updatedAt: new Date('2026-05-06T00:00:00Z'),
        committedAt: null,
        refundedAt: null,
      },
      reused: false,
    }),
    commitReservation: async () => undefined,
    refundReservation: async () => undefined,
  });

  await action(
    new Request('https://example.com/api/remover/upload', {
      method: 'POST',
      headers: {
        'cf-connecting-ip': '203.0.113.2',
      },
    })
  );

  assert.deepEqual(events, ['limit:203.0.113.2', 'storage', 'release']);
});
