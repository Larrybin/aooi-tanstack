import assert from 'node:assert/strict';
import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const CLOUDFLARE_WORKERS_ASSET_FILE_LIMIT_BYTES = 25 * 1024 * 1024;

test('MP4 Compressor vendor assets stay below Cloudflare Workers asset limit', async () => {
  const vendorDir = path.resolve('public/vendor/ffmpeg');
  const filenames = await readdir(vendorDir);

  assert.equal(
    filenames.includes('ffmpeg-core.wasm'),
    false,
    'ship the gzip-compressed wasm asset instead of the 30 MiB raw wasm'
  );
  assert.ok(filenames.includes('ffmpeg-core.wasm.gz'));

  for (const filename of filenames) {
    const filePath = path.join(vendorDir, filename);
    const fileStats = await stat(filePath);
    assert.ok(
      fileStats.size < CLOUDFLARE_WORKERS_ASSET_FILE_LIMIT_BYTES,
      `${filename} exceeds Cloudflare Workers asset file limit`
    );
  }
});
