import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { gzipSync } from 'node:zlib';

const clientAssetsDir = resolve(process.cwd(), 'dist/client/assets');
const hasClientBuild = existsSync(clientAssetsDir);
const requiresClientBuild = process.env.SITE === 'random-group-generator';

test(
  'random group generator home chunks stay within the 30 kB gzip budget',
  { skip: !hasClientBuild && !requiresClientBuild },
  () => {
    assert.ok(
      hasClientBuild,
      'random-group-generator bundle budget requires a completed client build'
    );

    const assetFiles = readdirSync(clientAssetsDir);
    const chunkPrefixes = ['home.view-', 'random-group-generator-home-'];
    const homeChunkFiles = chunkPrefixes.map((prefix) => {
      const matches = assetFiles.filter(
        (file) => file.startsWith(prefix) && file.endsWith('.js')
      );

      assert.equal(
        matches.length,
        1,
        `expected one ${prefix} client chunk, found ${matches.join(', ')}`
      );
      return matches[0]!;
    });
    const gzipBytes = homeChunkFiles.reduce(
      (total, file) =>
        total +
        gzipSync(readFileSync(resolve(clientAssetsDir, file))).byteLength,
      0
    );

    assert.ok(
      gzipBytes <= 30 * 1024,
      `random group generator home chunks are ${(gzipBytes / 1024).toFixed(2)} kB gzip (${homeChunkFiles.join(', ')})`
    );
  }
);
