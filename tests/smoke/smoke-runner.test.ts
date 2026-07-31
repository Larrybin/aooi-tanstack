import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  getSmokeScenarioCommand,
  SMOKE_SCENARIOS,
} from '../../scripts/smoke.mjs';

test('smoke runner: public scenarios map to existing runner scripts', () => {
  assert.deepEqual(Object.keys(SMOKE_SCENARIOS), ['auth-spike']);

  assert.equal(
    SMOKE_SCENARIOS['auth-spike'].script,
    'scripts/run-auth-spike.mjs'
  );
});

test('smoke runner: scenario command keeps tsx loader for TS imports', () => {
  const command = getSmokeScenarioCommand('auth-spike', {
    nodePath: '/usr/local/bin/node',
  });

  assert.equal(command.command, '/usr/local/bin/node');
  assert.deepEqual(command.args.slice(0, 2), ['--import', 'tsx']);
  assert.equal(
    command.args.at(-1)?.endsWith('scripts/run-auth-spike.mjs'),
    true
  );
});

test('package scripts: public smoke command names stay stable', async () => {
  const packageJson = JSON.parse(await readFile('package.json', 'utf8'));

  assert.equal(
    packageJson.scripts['test:auth-spike'],
    'node --import tsx scripts/smoke.mjs auth-spike'
  );
  assert.equal(packageJson.scripts['test:extended'], 'pnpm test:auth-spike');
});
