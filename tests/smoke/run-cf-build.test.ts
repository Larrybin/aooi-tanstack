import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildMultiBuildCheckArgs,
  buildOpenNextBuildArgs,
} from '../../scripts/run-cf-build.mjs';

test('cf:build 对 OpenNext 固定跳过根 wrangler config 交互检查', () => {
  assert.deepEqual(buildOpenNextBuildArgs(), [
    'exec',
    'opennextjs-cloudflare',
    'build',
    '--skipWranglerConfigCheck',
  ]);
});

test('cf:build forwards worker scope args to the dry-run upload check', () => {
  assert.deepEqual(buildMultiBuildCheckArgs(['--workers=public-web']), [
    '--import',
    'tsx',
    'scripts/run-cf-multi-build-check.mjs',
    '--workers=public-web',
  ]);
});
