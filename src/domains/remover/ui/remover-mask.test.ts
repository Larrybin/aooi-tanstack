import assert from 'node:assert/strict';
import test from 'node:test';

import { buildBinaryMaskPixels } from './remover-mask';

test('buildBinaryMaskPixels converts painted pixels to opaque white and empty pixels to opaque black', () => {
  const source = new Uint8ClampedArray([
    20, 184, 166, 122, 0, 0, 0, 0, 0, 0, 0, 255,
  ]);

  const mask = buildBinaryMaskPixels(source);

  assert.deepEqual(
    [...mask],
    [255, 255, 255, 255, 0, 0, 0, 255, 255, 255, 255, 255]
  );
});
