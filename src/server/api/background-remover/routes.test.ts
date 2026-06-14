import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createBackgroundRemoverRoutes,
  type BackgroundRemoverRoutesDeps,
  type BackgroundRemoverRouteTestActor,
  type BackgroundRemoverRouteTestStorage,
} from './routes-core';

const actor = {
  kind: 'anonymous',
  anonymousSessionId: 'anon_1',
} satisfies BackgroundRemoverRouteTestActor;

function createStorage(
  overrides: Partial<BackgroundRemoverRouteTestStorage> = {}
): BackgroundRemoverRouteTestStorage {
  return {
    deleteFiles: async () => undefined,
    getFile: async () => null,
    uploadFile: async () => ({
      success: true,
      provider: 'test',
      key: 'key',
      url: 'https://example.com/key',
      location: 'https://example.com/key',
    }),
    ...overrides,
  } as BackgroundRemoverRouteTestStorage;
}

function createDeps(
  overrides: Partial<BackgroundRemoverRoutesDeps> = {}
): BackgroundRemoverRoutesDeps {
  return {
    commitReservation: async () => undefined,
    createImage: async () => ({}) as never,
    findImageByIdForOwner: async () => null,
    getImagesBinding: () => null,
    getRuntimeEnvString: () => undefined,
    getStorageService: async () => createStorage(),
    listExpiredImages: async () => [],
    markImagesDeletedByIds: async () => [],
    refundReservation: async () => undefined,
    requireSite: () => undefined,
    reserveQuota: async () =>
      ({
        reservation: { id: 'reservation_1' },
        reused: false,
      }) as never,
    resolveActor: async () => actor,
    ...overrides,
  };
}

test('background remover cleanup requires configured bearer secret', async () => {
  let storageRead = false;
  const { postBackgroundRemoverCleanup } = createBackgroundRemoverRoutes(
    createDeps({
      getRuntimeEnvString: () => undefined,
      getStorageService: async () => {
        storageRead = true;
        return createStorage();
      },
    })
  );

  const response = await postBackgroundRemoverCleanup(
    new Request('https://example.com/api/background-remover/cleanup', {
      method: 'POST',
    })
  );

  assert.equal(response.status, 404);
  assert.equal(storageRead, false);
});

test('background remover cleanup rejects invalid bearer secret', async () => {
  let listedExpiredImages = false;
  const { postBackgroundRemoverCleanup } = createBackgroundRemoverRoutes(
    createDeps({
      getRuntimeEnvString: () => 'expected-secret',
      getStorageService: async () => createStorage(),
      listExpiredImages: async () => {
        listedExpiredImages = true;
        return [];
      },
    })
  );

  const response = await postBackgroundRemoverCleanup(
    new Request('https://example.com/api/background-remover/cleanup', {
      method: 'POST',
      headers: { authorization: 'Bearer wrong-secret' },
    })
  );

  assert.equal(response.status, 403);
  assert.equal(listedExpiredImages, false);
});

test('background remover result route forwards id params and Set-Cookie', async () => {
  let forwardedId = '';
  const { getBackgroundRemoverResult } = createBackgroundRemoverRoutes(
    createDeps({
      findImageByIdForOwner: async ({ id }) => {
        forwardedId = id;
        return {
          id,
          userId: null,
          anonymousSessionId: 'anon_1',
          originalStorageKey: 'original.png',
          resultStorageKey: 'result.png',
          originalMimeType: 'image/png',
          resultMimeType: 'image/png',
          originalByteSize: 1,
          resultByteSize: 2,
          width: 10,
          height: 10,
          status: 'active',
          quotaReservationId: 'quota_1',
          createdAt: new Date('2026-01-01T00:00:00Z'),
          updatedAt: new Date('2026-01-01T00:00:00Z'),
          deletedAt: null,
          expiresAt: new Date('2027-01-02T00:00:00Z'),
        } as never;
      },
      getStorageService: async () =>
        createStorage({
          getFile: async () => ({
            body: new ReadableStream<Uint8Array>({
              start(controller) {
                controller.enqueue(new Uint8Array([1, 2]));
                controller.close();
              },
            }),
            contentLength: 2,
            contentType: 'image/png',
          }),
        }),
      resolveActor: async (_req, sink) => {
        sink?.appendSetCookie('anon=1; Path=/; HttpOnly');
        return actor;
      },
    })
  );

  const response = await getBackgroundRemoverResult(
    new Request('https://example.com/api/background-remover/result/result_1'),
    { params: { id: 'result_1' } }
  );

  assert.equal(response.status, 200);
  assert.equal(forwardedId, 'result_1');
  assert.equal(response.headers.get('set-cookie'), 'anon=1; Path=/; HttpOnly');
  assert.equal(response.headers.get('content-type'), 'image/png');
  assert.equal(response.headers.get('content-length'), '2');
});

test('background remover download route returns attachment response', async () => {
  const { getBackgroundRemoverDownload } = createBackgroundRemoverRoutes(
    createDeps({
      findImageByIdForOwner: async ({ id }) =>
        ({
          id,
          userId: null,
          anonymousSessionId: 'anon_1',
          originalStorageKey: 'original.png',
          resultStorageKey: 'result.png',
          originalMimeType: 'image/png',
          resultMimeType: 'image/png',
          originalByteSize: 1,
          resultByteSize: 2,
          width: 10,
          height: 10,
          status: 'active',
          quotaReservationId: 'quota_1',
          createdAt: new Date('2026-01-01T00:00:00Z'),
          updatedAt: new Date('2026-01-01T00:00:00Z'),
          deletedAt: null,
          expiresAt: new Date('2027-01-02T00:00:00Z'),
        }) as never,
      getStorageService: async () =>
        createStorage({
          getFile: async () => ({
            body: new ReadableStream<Uint8Array>({
              start(controller) {
                controller.enqueue(new Uint8Array([1, 2]));
                controller.close();
              },
            }),
            contentLength: 2,
            contentType: 'image/png',
          }),
        }),
    })
  );

  const response = await getBackgroundRemoverDownload(
    new Request('https://example.com/api/background-remover/download/result_1'),
    { params: { id: 'result_1' } }
  );

  assert.equal(response.status, 200);
  assert.match(
    response.headers.get('content-disposition') || '',
    /^attachment; filename="background-remover-result_1\.png"/
  );
});
