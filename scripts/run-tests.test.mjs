import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import test from 'node:test';

import { filterRequestedTestFiles, parseTestRunnerArgs } from './run-tests.mjs';

test('parseTestRunnerArgs keeps coverage separate from selected files', () => {
  assert.deepEqual(
    parseTestRunnerArgs([
      '--coverage',
      '--',
      'src/server/api/docs/search-index.server.test.ts',
    ]),
    {
      coverageEnabled: true,
      requestedFiles: ['src/server/api/docs/search-index.server.test.ts'],
    }
  );
});

test('filterRequestedTestFiles returns only requested tests', () => {
  const files = [
    resolve('src/server/api/docs/search-index.server.test.ts'),
    resolve('src/server/api/docs/search-route.server.test.ts'),
    resolve('scripts/run-tests.test.mjs'),
  ];

  assert.deepEqual(
    filterRequestedTestFiles(files, ['scripts/run-tests.test.mjs']),
    [resolve('scripts/run-tests.test.mjs')]
  );
});

test('filterRequestedTestFiles rejects unknown requested tests', () => {
  assert.throws(
    () => filterRequestedTestFiles([], ['src/server/missing.test.ts']),
    /Unknown test file\(s\): src\/server\/missing\.test\.ts/
  );
});

test('run-tests discovers tests under apps/web', () => {
  const result = spawnSync(
    process.execPath,
    [
      'scripts/run-tests.mjs',
      '--',
      'apps/web/src/server/cloudflare-bindings.server.test.ts',
    ],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
    }
  );

  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
});

test('conventions check remains executable', () => {
  const result = spawnSync(
    process.execPath,
    ['scripts/conventions-index.mjs', '--check'],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
    }
  );

  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
});
