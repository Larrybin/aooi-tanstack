import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { gzipSync } from 'node:zlib';

const clientAssetsDir = resolve(process.cwd(), 'dist/client/assets');
const hasClientBuild = existsSync(clientAssetsDir);

test(
  '401k home view stays within the 30 kB gzip budget',
  { skip: !hasClientBuild },
  () => {
    const homeViewFiles = readdirSync(clientAssetsDir).filter(
      (file) => file.startsWith('home.view-') && file.endsWith('.js')
    );

    assert.equal(
      homeViewFiles.length,
      1,
      `expected one home.view client chunk, found ${homeViewFiles.join(', ')}`
    );
    const payload = readFileSync(resolve(clientAssetsDir, homeViewFiles[0]!));
    const gzipBytes = gzipSync(payload).byteLength;

    assert.ok(
      gzipBytes <= 30 * 1024,
      `home.view client chunk is ${(gzipBytes / 1024).toFixed(2)} kB gzip`
    );
  }
);
