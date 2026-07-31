import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const source = readFileSync(
  resolve(process.cwd(), 'src/surfaces/landing/home/product-home.view.tsx'),
  'utf8'
);

const productModules = [
  'remover-home',
  'background-remover-home',
  'text-to-speech-home',
  'mp4-compressor-home',
  'random-group-generator-home',
];

test('product home components are loaded through separate lazy chunks', () => {
  for (const moduleName of productModules) {
    assert.doesNotMatch(
      source,
      new RegExp(`^import .*${moduleName}`, 'm'),
      `${moduleName} must not be statically imported`
    );
    assert.match(
      source,
      new RegExp(`lazy\\([\\s\\S]*?import\\([^)]*${moduleName}`),
      `${moduleName} must be lazy loaded`
    );
  }
});
