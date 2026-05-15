import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  buildVersionUploadDryRunArgs,
  parseDryRunUploadSize,
  resolveBuildWorkerKeys,
} from '../../scripts/run-cf-multi-build-check.mjs';

test('run-cf-multi-build-check 只覆盖 app worker，不再 dry-run state', async () => {
  const source = await readFile('scripts/run-cf-multi-build-check.mjs', 'utf8');

  assert.doesNotMatch(source, /label:\s*['"]state['"]/);
  assert.doesNotMatch(source, /buildStateDryRunArgs/);
  assert.doesNotMatch(source, /wrangler\.state\.toml/);
});

test('run-cf-multi-build-check supports scoped app worker dry-runs', () => {
  assert.deepEqual(resolveBuildWorkerKeys(['--workers=router,public-web']), [
    'router',
    'public-web',
  ]);
});

test('parseDryRunUploadSize 解析 wrangler dry-run 输出中的 total/gzip 体积', () => {
  const sizes = parseDryRunUploadSize(`
Total Upload: 10867.16 KiB / gzip: 2136.66 KiB
Your Worker has access to the following bindings:
`);

  assert.deepEqual(sizes, {
    totalKiB: 10867.16,
    gzipKiB: 2136.66,
  });
});

test('parseDryRunUploadSize 在缺少体积行时失败', () => {
  assert.throws(
    () => parseDryRunUploadSize('no size info'),
    /parse dry-run upload size/i
  );
});

test('buildVersionUploadDryRunArgs 为 app worker 固定使用 wrangler versions upload --dry-run', () => {
  assert.deepEqual(
    buildVersionUploadDryRunArgs({
      configPath: '/tmp/wrangler.server-public-web.toml',
      name: 'roller-rabbit-public-web',
      secretsPath: '/tmp/public-web.secrets.env',
    }),
    [
      'versions',
      'upload',
      '--dry-run',
      '--config',
      '/tmp/wrangler.server-public-web.toml',
      '--name',
      'roller-rabbit-public-web',
      '--secrets-file',
      '/tmp/public-web.secrets.env',
    ]
  );
});
