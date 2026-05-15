import assert from 'node:assert/strict';
import test from 'node:test';

import type { RemoverJob } from '../infra/job';

const job = {
  id: 'job_1',
  userId: null,
  anonymousSessionId: 'anon_1',
  expiresAt: new Date('2026-05-07T00:00:00Z'),
} as RemoverJob;

test('storeRemoverOutputImage stores a guarded provider output image when fetch succeeds', async () => {
  const { storeRemoverOutputImage } = await import('./output');
  const uploads: Array<{ key: string; contentType?: string }> = [];

  const result = await storeRemoverOutputImage({
    job,
    outputImageUrl: 'https://provider.example.com/output.png',
    deps: {
      fetchImage: async () =>
        new Response(Buffer.from([1, 2, 3]), {
          headers: { 'content-type': 'image/png' },
        }),
      storageService: {
        uploadFile: async (options) => {
          uploads.push({ key: options.key, contentType: options.contentType });
          return {
            success: true,
            key: options.key,
            url: `https://assets.example.com/${options.key}`,
          };
        },
        deleteFiles: async () => undefined,
      },
      createAssets: async (assets) =>
        assets.map((asset) => ({
          ...asset,
          createdAt: new Date('2026-05-06T00:00:00Z'),
          updatedAt: new Date('2026-05-06T00:00:00Z'),
          deletedAt: null,
        })),
      transformLowResImage: async ({ buffer }) => ({
        buffer: Buffer.from([...buffer, 4]),
        mimeType: 'image/webp',
      }),
      createId: (() => {
        const ids = ['output_1', 'thumbnail_1'];
        return () => ids.shift() || 'id';
      })(),
    },
  });

  assert.equal(
    result.outputAsset.storageKey,
    'remover/anonymous/anon_1/output/output_1.png'
  );
  assert.equal(
    result.thumbnailAsset.storageKey,
    'remover/anonymous/anon_1/thumbnail/thumbnail_1.webp'
  );
  assert.notEqual(result.outputAsset.storageKey, result.thumbnailAsset.storageKey);
  assert.deepEqual(uploads, [
    {
      key: 'remover/anonymous/anon_1/output/output_1.png',
      contentType: 'image/png',
    },
    {
      key: 'remover/anonymous/anon_1/thumbnail/thumbnail_1.webp',
      contentType: 'image/webp',
    },
  ]);
});

test('storeRemoverOutputImage stores an internal provider data URL without fetching', async () => {
  const { storeRemoverOutputImage } = await import('./output');
  let fetched = false;

  const result = await storeRemoverOutputImage({
    job,
    outputImageUrl: `data:image/png;base64,${Buffer.from([4, 5, 6]).toString(
      'base64'
    )}`,
    deps: {
      fetchImage: async () => {
        fetched = true;
        return new Response(null, { status: 500 });
      },
      storageService: {
        uploadFile: async (options) => ({
          success: true,
          key: options.key,
          url: `https://assets.example.com/${options.key}`,
        }),
        deleteFiles: async () => undefined,
      },
      createAssets: async (assets) =>
        assets.map((asset) => ({
          ...asset,
          createdAt: new Date('2026-05-06T00:00:00Z'),
          updatedAt: new Date('2026-05-06T00:00:00Z'),
          deletedAt: null,
        })),
      transformLowResImage: async ({ buffer }) => ({
        buffer,
        mimeType: 'image/webp',
      }),
      createId: (() => {
        const ids = ['output_2', 'thumbnail_2'];
        return () => ids.shift() || 'id';
      })(),
    },
  });

  assert.equal(fetched, false);
  assert.equal(
    result.outputAsset.storageKey,
    'remover/anonymous/anon_1/output/output_2.png'
  );
  assert.equal(result.outputAsset.byteSize, 3);
  assert.equal(
    result.thumbnailAsset.storageKey,
    'remover/anonymous/anon_1/thumbnail/thumbnail_2.webp'
  );
});

test('storeRemoverOutputImage rejects oversized data URLs before decoding', async () => {
  const { storeRemoverOutputImage } = await import('./output');
  let fetched = false;
  let uploaded = false;
  const oversizedBase64 = 'A'.repeat(36 * 1024 * 1024);

  await assert.rejects(
    () =>
      storeRemoverOutputImage({
        job,
        outputImageUrl: `data:image/png;base64,${oversizedBase64}`,
        deps: {
          fetchImage: async () => {
            fetched = true;
            return new Response(null, { status: 500 });
          },
          storageService: {
            uploadFile: async () => {
              uploaded = true;
              return {
                success: false,
                error: 'should not upload',
              };
            },
            deleteFiles: async () => undefined,
          },
          createAssets: async () => [],
          transformLowResImage: async ({ buffer }) => ({
            buffer,
            mimeType: 'image/webp',
          }),
        },
      }),
    /provider output image is too large/
  );

  assert.equal(fetched, false);
  assert.equal(uploaded, false);
});

test('storeRemoverOutputImage rejects oversized URL outputs before reading body', async () => {
  const { storeRemoverOutputImage } = await import('./output');
  let uploaded = false;

  await assert.rejects(
    () =>
      storeRemoverOutputImage({
        job,
        outputImageUrl: 'https://provider.example.com/output.png',
        deps: {
          fetchImage: async () =>
            new Response(null, {
              headers: {
                'content-type': 'image/png',
                'content-length': String(26 * 1024 * 1024),
              },
            }),
          storageService: {
            uploadFile: async () => {
              uploaded = true;
              return {
                success: false,
                error: 'should not upload',
              };
            },
            deleteFiles: async () => undefined,
          },
          createAssets: async () => [],
          transformLowResImage: async ({ buffer }) => ({
            buffer,
            mimeType: 'image/webp',
          }),
        },
      }),
    /provider output image is too large/
  );

  assert.equal(uploaded, false);
});

test('storeRemoverOutputImage rejects URL outputs that stream past the size cap', async () => {
  const { storeRemoverOutputImage } = await import('./output');
  let uploaded = false;

  await assert.rejects(
    () =>
      storeRemoverOutputImage({
        job,
        outputImageUrl: 'https://provider.example.com/output.png',
        deps: {
          fetchImage: async () =>
            new Response(
              new ReadableStream({
                start(controller) {
                  controller.enqueue(new Uint8Array(25 * 1024 * 1024));
                  controller.enqueue(new Uint8Array(1));
                  controller.close();
                },
              }),
              {
                headers: {
                  'content-type': 'image/png',
                },
              }
            ),
          storageService: {
            uploadFile: async () => {
              uploaded = true;
              return {
                success: false,
                error: 'should not upload',
              };
            },
            deleteFiles: async () => undefined,
          },
          createAssets: async () => [],
          transformLowResImage: async ({ buffer }) => ({
            buffer,
            mimeType: 'image/webp',
          }),
        },
      }),
    /provider output image is too large/
  );

  assert.equal(uploaded, false);
});

test('storeRemoverOutputImage deletes uploaded output when low-res upload fails', async () => {
  const { storeRemoverOutputImage } = await import('./output');
  const deletedKeys: string[] = [];
  let uploadCount = 0;

  await assert.rejects(
    () =>
      storeRemoverOutputImage({
        job,
        outputImageUrl: 'https://provider.example.com/output.png',
        deps: {
          fetchImage: async () =>
            new Response(Buffer.from([1, 2, 3]), {
              headers: { 'content-type': 'image/png' },
            }),
          storageService: {
            uploadFile: async (options) => {
              uploadCount += 1;
              if (uploadCount === 2) {
                return {
                  success: false,
                  error: 'thumbnail upload failed',
                };
              }
              return {
                success: true,
                key: options.key,
                url: `https://assets.example.com/${options.key}`,
              };
            },
            deleteFiles: async (keys) => {
              deletedKeys.push(...keys);
            },
          },
          createAssets: async () => {
            throw new Error('should not create assets after upload failure');
          },
          transformLowResImage: async ({ buffer }) => ({
            buffer,
            mimeType: 'image/webp',
          }),
          createId: (() => {
            const ids = ['output_failed', 'thumbnail_failed'];
            return () => ids.shift() || 'id';
          })(),
        },
      }),
    /thumbnail upload failed/
  );

  assert.deepEqual(deletedKeys, [
    'remover/anonymous/anon_1/output/output_failed.png',
  ]);
});

test('transformLowResImageWithCloudflareImages resizes and encodes thumbnail output', async () => {
  const { transformLowResImageWithCloudflareImages } = await import('./output');
  const transforms: unknown[] = [];
  const outputs: unknown[] = [];
  const transformer: ImageTransformer = {
    transform(transform: ImageTransform) {
      transforms.push(transform);
      return transformer;
    },
    draw() {
      return transformer;
    },
    async output(output: ImageOutputOptions) {
      outputs.push(output);
      return {
        response: () =>
          new Response(Buffer.from([9, 8, 7]), {
            headers: { 'content-type': 'image/webp' },
          }),
        contentType: () => 'image/webp',
        image: () =>
          new ReadableStream<Uint8Array>({
            start(controller) {
              controller.enqueue(new Uint8Array([9, 8, 7]));
              controller.close();
            },
          }),
      };
    },
  };
  const images: Pick<ImagesBinding, 'input'> = {
    input: () => transformer,
  };

  const result = await transformLowResImageWithCloudflareImages({
    buffer: Buffer.from([1, 2, 3]),
    mimeType: 'image/png',
    images,
  });

  assert.deepEqual(transforms, [
    { width: 1280, height: 1280, fit: 'scale-down' },
  ]);
  assert.deepEqual(outputs, [{ format: 'image/webp', quality: 72 }]);
  assert.deepEqual([...result.buffer], [9, 8, 7]);
  assert.equal(result.mimeType, 'image/webp');
});
