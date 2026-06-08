import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import test from 'node:test';

import { filterRequestedTestFiles, parseTestRunnerArgs } from './run-tests.mjs';

test('parseTestRunnerArgs keeps coverage separate from selected files', () => {
  assert.deepEqual(
    parseTestRunnerArgs(['--coverage', '--', 'src/app/robots.server.test.ts']),
    {
      coverageEnabled: true,
      requestedFiles: ['src/app/robots.server.test.ts'],
    }
  );
});

test('filterRequestedTestFiles returns only requested tests', () => {
  const files = [
    resolve('src/app/robots.server.test.ts'),
    resolve('src/app/sitemap.server.test.ts'),
    resolve('scripts/run-tests.test.mjs'),
  ];

  assert.deepEqual(
    filterRequestedTestFiles(files, ['scripts/run-tests.test.mjs']),
    [resolve('scripts/run-tests.test.mjs')]
  );
});

test('filterRequestedTestFiles rejects unknown requested tests', () => {
  assert.throws(
    () => filterRequestedTestFiles([], ['src/app/missing.test.ts']),
    /Unknown test file\(s\): src\/app\/missing\.test\.ts/
  );
});
