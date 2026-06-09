import assert from 'node:assert/strict';
import test from 'node:test';
import { gzipSync } from 'node:zlib';

import { buildScaleArgs, fetchGzipBytes } from './mp4-compressor-workbench';

test('buildScaleArgs does not upscale landscape videos to the selected height', () => {
  assert.deepEqual(
    buildScaleArgs({
      resolution: '1080p',
      video: {
        width: 1280,
        height: 720,
      },
    }),
    []
  );
});

test('buildScaleArgs does not upscale portrait videos to the selected width', () => {
  assert.deepEqual(
    buildScaleArgs({
      resolution: '1080p',
      video: {
        width: 720,
        height: 1280,
      },
    }),
    []
  );
});

test('buildScaleArgs downscales only when the configured output dimension shrinks', () => {
  assert.deepEqual(
    buildScaleArgs({
      resolution: '1080p',
      video: {
        width: 3840,
        height: 2160,
      },
    }),
    ['-vf', 'scale=-2:1080']
  );
  assert.deepEqual(
    buildScaleArgs({
      resolution: '720p',
      video: {
        width: 1080,
        height: 1920,
      },
    }),
    ['-vf', 'scale=720:-2']
  );
});

test('fetchGzipBytes inflates a gzip response for wasm blob loading', async () => {
  const originalFetch = globalThis.fetch;
  const payload = new TextEncoder().encode('wasm bytes');
  const gzipped = gzipSync(payload);

  globalThis.fetch = async () =>
    new Response(gzipped, {
      status: 200,
    });

  try {
    assert.deepEqual(await fetchGzipBytes('/ffmpeg-core.wasm.gz'), payload);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
