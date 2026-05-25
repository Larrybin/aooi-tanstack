import assert from 'node:assert/strict';
import test from 'node:test';

import { UpstreamError } from '@/shared/lib/api/errors';

import { removeImageBackground } from './remove-background';

const PNG_BYTES = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3,
]);

function pngFile(bytes = PNG_BYTES) {
  return new File([bytes], 'product.png', { type: 'image/png' });
}

function createImagesBinding({
  resultBytes = Buffer.from([9, 8, 7]),
  status = 200,
  contentType = 'image/png',
}: {
  resultBytes?: Buffer;
  status?: number;
  contentType?: string;
} = {}) {
  const transforms: unknown[] = [];
  const outputs: unknown[] = [];
  const transformer: ImageTransformer = {
    transform(transform) {
      transforms.push(transform);
      return transformer;
    },
    draw() {
      return transformer;
    },
    async output(output) {
      outputs.push(output);
      return {
        response: () =>
          new Response(resultBytes, {
            status,
            headers: { 'content-type': contentType },
          }),
        contentType: () => contentType,
        image: () =>
          new ReadableStream<Uint8Array>({
            start(controller) {
              controller.enqueue(resultBytes);
              controller.close();
            },
          }),
      };
    },
  };

  return {
    transforms,
    outputs,
    binding: {
      input() {
        return transformer;
      },
    } satisfies Pick<ImagesBinding, 'input'>,
  };
}

test('removeImageBackground reserves quota, segments foreground, stores result, and commits', async () => {
  const uploaded: string[] = [];
  const committed: string[] = [];
  const images = createImagesBinding();

  const result = await removeImageBackground({
    actor: { kind: 'anonymous', anonymousSessionId: 'anon_1' },
    file: pngFile(),
    width: 1200,
    height: 800,
    deps: {
      storageService: {
        async uploadFile(options) {
          uploaded.push(options.key);
          return {
            success: true,
            provider: 'test',
            key: options.key,
            url: `https://assets.example/${options.key}`,
          };
        },
        async deleteFiles() {
          throw new Error('should not delete on success');
        },
      },
      images: images.binding,
      detectImageMime: () => 'image/png',
      createImage: async (input) => ({
        ...input,
        createdAt: new Date('2026-05-25T00:00:00Z'),
        updatedAt: new Date('2026-05-25T00:00:00Z'),
        deletedAt: null,
      }),
      markImagesDeletedByIds: async () => {
        throw new Error('should not mark image deleted on success');
      },
      reserveQuota: async (input) => ({
        reservation: {
          id: 'reservation_1',
          userId: null,
          anonymousSessionId: 'anon_1',
          siteKey: 'background-remover',
          productKey: 'background-remover',
          productId: input.productId,
          operationKey: input.operationKey,
          units: 1,
          status: 'reserved',
          idempotencyKey: input.idempotencyKey,
          jobId: null,
          reason: null,
          entitlementGrantIdsJson: null,
          createdAt: new Date('2026-05-25T00:00:00Z'),
          updatedAt: new Date('2026-05-25T00:00:00Z'),
          committedAt: null,
          refundedAt: null,
          expiresAt: input.expiresAt,
        },
        reused: false,
      }),
      commitReservation: async ({ reservationId }) => {
        committed.push(reservationId);
      },
      refundReservation: async () => {
        throw new Error('should not refund on success');
      },
      now: () => new Date('2026-05-25T00:00:00Z'),
      createId: () => 'result_1',
    },
  });

  assert.deepEqual(images.transforms, [{ segment: 'foreground' }]);
  assert.deepEqual(images.outputs, [{ format: 'image/png' }]);
  assert.deepEqual(uploaded, [
    'background-remover/anonymous/anon_1/result_1/original.png',
    'background-remover/anonymous/anon_1/result_1/result.png',
  ]);
  assert.deepEqual(committed, ['reservation_1']);
  assert.equal(result.id, 'result_1');
  assert.equal(result.previewUrl, '/api/background-remover/result/result_1');
  assert.equal(result.downloadUrl, '/api/background-remover/download/result_1');
});

test('removeImageBackground refunds quota and deletes uploaded original when transform fails', async () => {
  const deleted: string[][] = [];
  const refunded: string[] = [];
  const transformer: ImageTransformer = {
    transform() {
      throw new Error('segment failed');
    },
    draw() {
      return transformer;
    },
    async output() {
      throw new Error('should not output');
    },
  };

  await assert.rejects(
    removeImageBackground({
      actor: { kind: 'anonymous', anonymousSessionId: 'anon_1' },
      file: pngFile(),
      width: 1200,
      height: 800,
      deps: {
        storageService: {
          async uploadFile(options) {
            return {
              success: true,
              provider: 'test',
              key: options.key,
              url: `https://assets.example/${options.key}`,
            };
          },
          async deleteFiles(keys) {
            deleted.push(keys);
          },
        },
        images: {
          input() {
            return transformer;
          },
        },
        detectImageMime: () => 'image/png',
        createImage: async () => {
          throw new Error('should not create image');
        },
        markImagesDeletedByIds: async () => {
          throw new Error('should not mark image deleted');
        },
        reserveQuota: async (input) => ({
          reservation: {
            id: 'reservation_1',
            userId: null,
            anonymousSessionId: 'anon_1',
            siteKey: 'background-remover',
            productKey: 'background-remover',
            productId: input.productId,
            operationKey: input.operationKey,
            units: 1,
            status: 'reserved',
            idempotencyKey: input.idempotencyKey,
            jobId: null,
            reason: null,
            entitlementGrantIdsJson: null,
            createdAt: new Date('2026-05-25T00:00:00Z'),
            updatedAt: new Date('2026-05-25T00:00:00Z'),
            committedAt: null,
            refundedAt: null,
            expiresAt: input.expiresAt,
          },
          reused: false,
        }),
        commitReservation: async () => {
          throw new Error('should not commit');
        },
        refundReservation: async ({ reservationId }) => {
          refunded.push(reservationId);
        },
        now: () => new Date('2026-05-25T00:00:00Z'),
        createId: () => 'result_1',
      },
    }),
    /segment failed/
  );

  assert.deepEqual(refunded, ['reservation_1']);
  assert.deepEqual(deleted, [
    ['background-remover/anonymous/anon_1/result_1/original.png'],
  ]);
});

test('removeImageBackground rejects failed Images responses before storing result', async () => {
  const uploaded: string[] = [];
  const deleted: string[][] = [];
  const refunded: string[] = [];
  const images = createImagesBinding({
    resultBytes: Buffer.from('{"errors":[{"message":"invalid image"}]}'),
    status: 400,
    contentType: 'application/json',
  });

  await assert.rejects(
    removeImageBackground({
      actor: { kind: 'anonymous', anonymousSessionId: 'anon_1' },
      file: pngFile(),
      width: 1200,
      height: 800,
      deps: {
        storageService: {
          async uploadFile(options) {
            uploaded.push(options.key);
            return {
              success: true,
              provider: 'test',
              key: options.key,
              url: `https://assets.example/${options.key}`,
            };
          },
          async deleteFiles(keys) {
            deleted.push(keys);
          },
        },
        images: images.binding,
        detectImageMime: () => 'image/png',
        createImage: async () => {
          throw new Error('should not create image');
        },
        markImagesDeletedByIds: async () => {
          throw new Error('should not mark image deleted');
        },
        reserveQuota: async (input) => ({
          reservation: {
            id: 'reservation_1',
            userId: null,
            anonymousSessionId: 'anon_1',
            siteKey: 'background-remover',
            productKey: 'background-remover',
            productId: input.productId,
            operationKey: input.operationKey,
            units: 1,
            status: 'reserved',
            idempotencyKey: input.idempotencyKey,
            jobId: null,
            reason: null,
            entitlementGrantIdsJson: null,
            createdAt: new Date('2026-05-25T00:00:00Z'),
            updatedAt: new Date('2026-05-25T00:00:00Z'),
            committedAt: null,
            refundedAt: null,
            expiresAt: input.expiresAt,
          },
          reused: false,
        }),
        commitReservation: async () => {
          throw new Error('should not commit');
        },
        refundReservation: async ({ reservationId }) => {
          refunded.push(reservationId);
        },
        now: () => new Date('2026-05-25T00:00:00Z'),
        createId: () => 'result_1',
      },
    }),
    (error) =>
      error instanceof UpstreamError &&
      error.status === 502 &&
      /background removal failed/.test(error.message)
  );

  assert.deepEqual(uploaded, [
    'background-remover/anonymous/anon_1/result_1/original.png',
  ]);
  assert.deepEqual(refunded, ['reservation_1']);
  assert.deepEqual(deleted, [
    ['background-remover/anonymous/anon_1/result_1/original.png'],
  ]);
});

test('removeImageBackground marks created image deleted when quota commit fails', async () => {
  const deleted: string[][] = [];
  const markedDeleted: string[][] = [];
  const refunded: string[] = [];
  const images = createImagesBinding();

  await assert.rejects(
    removeImageBackground({
      actor: { kind: 'anonymous', anonymousSessionId: 'anon_1' },
      file: pngFile(),
      width: 1200,
      height: 800,
      deps: {
        storageService: {
          async uploadFile(options) {
            return {
              success: true,
              provider: 'test',
              key: options.key,
              url: `https://assets.example/${options.key}`,
            };
          },
          async deleteFiles(keys) {
            deleted.push(keys);
          },
        },
        images: images.binding,
        detectImageMime: () => 'image/png',
        createImage: async (input) => ({
          ...input,
          createdAt: new Date('2026-05-25T00:00:00Z'),
          updatedAt: new Date('2026-05-25T00:00:00Z'),
          deletedAt: null,
        }),
        markImagesDeletedByIds: async ({ ids }) => {
          markedDeleted.push(ids);
          return [];
        },
        reserveQuota: async (input) => ({
          reservation: {
            id: 'reservation_1',
            userId: null,
            anonymousSessionId: 'anon_1',
            siteKey: 'background-remover',
            productKey: 'background-remover',
            productId: input.productId,
            operationKey: input.operationKey,
            units: 1,
            status: 'reserved',
            idempotencyKey: input.idempotencyKey,
            jobId: null,
            reason: null,
            entitlementGrantIdsJson: null,
            createdAt: new Date('2026-05-25T00:00:00Z'),
            updatedAt: new Date('2026-05-25T00:00:00Z'),
            committedAt: null,
            refundedAt: null,
            expiresAt: input.expiresAt,
          },
          reused: false,
        }),
        commitReservation: async () => {
          throw new Error('commit failed');
        },
        refundReservation: async ({ reservationId }) => {
          refunded.push(reservationId);
        },
        now: () => new Date('2026-05-25T00:00:00Z'),
        createId: () => 'result_1',
      },
    }),
    /commit failed/
  );

  assert.deepEqual(markedDeleted, [['result_1']]);
  assert.deepEqual(refunded, ['reservation_1']);
  assert.deepEqual(deleted, [
    [
      'background-remover/anonymous/anon_1/result_1/original.png',
      'background-remover/anonymous/anon_1/result_1/result.png',
    ],
  ]);
});

test('removeImageBackground rejects unsupported image formats before quota reserve', async () => {
  let reserved = false;

  await assert.rejects(
    removeImageBackground({
      actor: { kind: 'anonymous', anonymousSessionId: 'anon_1' },
      file: new File([Buffer.from('GIF89a')], 'image.gif', {
        type: 'image/gif',
      }),
      width: 100,
      height: 100,
      deps: {
        storageService: {
          async uploadFile() {
            throw new Error('should not upload');
          },
          async deleteFiles() {},
        },
        images: createImagesBinding().binding,
        detectImageMime: () => 'image/gif',
        createImage: async () => {
          throw new Error('should not create image');
        },
        markImagesDeletedByIds: async () => {
          throw new Error('should not mark image deleted');
        },
        reserveQuota: async () => {
          reserved = true;
          throw new Error('should not reserve');
        },
        commitReservation: async () => {},
        refundReservation: async () => {},
      },
    }),
    /PNG, JPG, JPEG, or WebP/
  );

  assert.equal(reserved, false);
});
