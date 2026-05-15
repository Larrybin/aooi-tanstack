import assert from 'node:assert/strict';
import test from 'node:test';

import { ServiceUnavailableError } from '@/shared/lib/api/errors';

import {
  createCloudflareWorkersAIRemoverAdapter,
  createRemoverInputImageFetcher,
} from './provider';

test('createCloudflareWorkersAIRemoverAdapter calls Workers AI with image and mask bytes', async () => {
  const calls: Array<{ model: string; inputs: Record<string, unknown> }> = [];
  const adapter = createCloudflareWorkersAIRemoverAdapter({
    ai: {
      async run(model, inputs) {
        calls.push({ model, inputs });
        return new Response(Buffer.from([1, 2, 3]), {
          headers: { 'content-type': 'image/png' },
        });
      },
    },
    fetchInputImageBytes: async (url) =>
      url.includes('mask') ? [9, 8, 7] : [1, 2, 3],
    createProviderTaskId: () => 'cloudflare-workers-ai:test-task',
  });

  const result = await adapter.submitTask({
    inputImageUrl: 'https://assets.example.com/original.png',
    maskImageUrl: 'https://assets.example.com/mask.png',
  });

  assert.equal(adapter.config.provider, 'cloudflare-workers-ai');
  assert.equal(
    calls[0]?.model,
    '@cf/runwayml/stable-diffusion-v1-5-inpainting'
  );
  assert.deepEqual(calls[0]?.inputs.image, [1, 2, 3]);
  assert.deepEqual(calls[0]?.inputs.mask, [9, 8, 7]);
  assert.equal(result.providerTaskId, 'cloudflare-workers-ai:test-task');
  assert.equal(result.status, 'succeeded');
  assert.equal(
    result.outputImageUrl,
    `data:image/png;base64,${Buffer.from([1, 2, 3]).toString('base64')}`
  );
});

test('createRemoverInputImageFetcher can explicitly allow local smoke asset URLs', async () => {
  const calls: Array<{ url: string; options?: Record<string, unknown> }> = [];
  const fetchImageBytes = createRemoverInputImageFetcher({
    allowLocalHttp: true,
    safeFetchImpl: async (url, _init, options) => {
      calls.push({ url, options });
      return new Response(Buffer.from([1, 2, 3]), {
        headers: { 'content-type': 'image/png' },
      });
    },
  });

  assert.deepEqual(
    await fetchImageBytes('http://127.0.0.1:8787/assets/asset.png'),
    [1, 2, 3]
  );
  assert.deepEqual(calls, [
    {
      url: 'http://127.0.0.1:8787/assets/asset.png',
      options: {
        timeoutMs: 15000,
        allowInsecureHttp: true,
        allowPrivateNetwork: true,
      },
    },
  ]);
});

test('createCloudflareWorkersAIRemoverAdapter rejects unsupported Workers AI output', async () => {
  const adapter = createCloudflareWorkersAIRemoverAdapter({
    ai: {
      async run() {
        return { unexpected: true };
      },
    },
    fetchInputImageBytes: async () => [1],
  });

  await assert.rejects(
    () =>
      adapter.submitTask({
        inputImageUrl: 'https://assets.example.com/original.png',
        maskImageUrl: 'https://assets.example.com/mask.png',
      }),
    ServiceUnavailableError
  );
});

test('createCloudflareWorkersAIRemoverAdapter rejects oversized Workers AI response streams', async () => {
  const adapter = createCloudflareWorkersAIRemoverAdapter({
    ai: {
      async run() {
        return new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(new Uint8Array(25 * 1024 * 1024));
              controller.enqueue(new Uint8Array(1));
              controller.close();
            },
          }),
          {
            headers: { 'content-type': 'image/png' },
          }
        );
      },
    },
    fetchInputImageBytes: async () => [1],
  });

  await assert.rejects(
    () =>
      adapter.submitTask({
        inputImageUrl: 'https://assets.example.com/original.png',
        maskImageUrl: 'https://assets.example.com/mask.png',
      }),
    /Workers AI output image is too large/
  );
});
