import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { gzipSync } from 'node:zlib';

const clientAssetsDir = resolve(
  process.cwd(),
  'dist/anagram-generator/client/assets'
);
const hasClientBuild = existsSync(clientAssetsDir);
const isTargetSite = process.env.SITE === 'anagram-generator';

test(
  'anagram generator home entry stays within the 30 kB gzip budget',
  { skip: !isTargetSite },
  () => {
    assert.ok(
      hasClientBuild,
      'anagram-generator bundle budget requires a completed client build'
    );

    const assetFiles = readdirSync(clientAssetsDir);
    const homeChunkFiles = assetFiles.filter(
      (file) => file.startsWith('home.view-') && file.endsWith('.js')
    );

    assert.equal(
      homeChunkFiles.length,
      1,
      `expected one home.view- client chunk, found ${homeChunkFiles.join(', ')}`
    );
    assert.equal(
      assetFiles.some(
        (file) =>
          file.startsWith('anagram-generator-home-') && file.endsWith('.js')
      ),
      false,
      'anagram generator must stay in the eager site-home entry for hydration'
    );

    const gzipBytes = gzipSync(
      readFileSync(resolve(clientAssetsDir, homeChunkFiles[0]!))
    ).byteLength;

    assert.ok(
      gzipBytes <= 30 * 1024,
      `anagram generator home entry is ${(gzipBytes / 1024).toFixed(2)} kB gzip (${homeChunkFiles.join(', ')})`
    );
  }
);
