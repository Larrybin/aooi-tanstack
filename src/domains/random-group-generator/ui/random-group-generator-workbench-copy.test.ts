import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

import type { RandomGroupGeneratorHomeCopy } from './random-group-generator-home-copy';
import {
  buildNamesReadyText,
  buildResultStatus,
  buildSplitSummary,
} from './random-group-generator-workbench-copy';

const homeContent = JSON.parse(
  readFileSync(
    resolve(process.cwd(), 'sites/random-group-generator/content/home.en.json'),
    'utf8'
  )
) as RandomGroupGeneratorHomeCopy;
const copy = homeContent.workbench;

test('workbench copy uses singular and plural name labels', () => {
  assert.equal(buildNamesReadyText(1, copy), '1 name ready');
  assert.equal(buildNamesReadyText(2, copy), '2 names ready');
});

test('workbench copy uses a singular group label for one-group previews', () => {
  assert.equal(
    buildSplitSummary(1, 'size', 99, copy),
    '1 name will create 1 random group with up to 99 people per group.'
  );
  assert.equal(buildResultStatus(2, 1, copy), '2 names split into 1 group.');
});
