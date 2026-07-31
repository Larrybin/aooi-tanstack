import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { gzipSync } from 'node:zlib';

const clientAssetsDir = resolve(process.cwd(), 'dist/client/assets');
const hasClientBuild = existsSync(clientAssetsDir);

test(
  '401k home entry stays within the 30 kB gzip budget',
  { skip: !hasClientBuild },
  () => {
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
          file.startsWith('401k-calculator-home-') && file.endsWith('.js')
      ),
      false,
      '401k calculator must stay in the eager home entry for hydration'
    );

    const gzipBytes = gzipSync(
      readFileSync(resolve(clientAssetsDir, homeChunkFiles[0]!))
    ).byteLength;

    assert.ok(
      gzipBytes <= 30 * 1024,
      `401k home client chunks are ${(gzipBytes / 1024).toFixed(2)} kB gzip (${homeChunkFiles.join(', ')})`
    );
  }
);
