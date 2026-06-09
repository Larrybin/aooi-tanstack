import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  buildSiteGateSteps,
  findFocusedProductTestFiles,
  runSiteGate,
} from '../../scripts/site-gate.mjs';

test('site gate includes no-DB build for free-tool-no-db profiles', () => {
  const steps = buildSiteGateSteps({
    siteKey: 'mp4-compressor',
    profile: 'free-tool-no-db',
    focusedTestFiles: [
      'src/domains/mp4-compressor/ui/mp4-compressor-workbench.test.ts',
      'tests/smoke/mp4-compressor-assets.test.ts',
    ],
  });

  assert.deepEqual(
    steps.map((step) => step.args),
    [
      ['site:contract'],
      ['build'],
      ['cf:check'],
      ['cf:build:no-db', '--site', 'mp4-compressor'],
      [
        'test',
        '--',
        'src/domains/mp4-compressor/ui/mp4-compressor-workbench.test.ts',
        'tests/smoke/mp4-compressor-assets.test.ts',
      ],
    ]
  );
  assert.equal(steps[2].env.SITE, 'mp4-compressor');
  assert.equal(steps[2].env.DATABASE_URL, '');
  assert.equal(
    steps[2].env.STORAGE_PUBLIC_BASE_URL,
    'http://127.0.0.1:8787/assets/'
  );
});

test('site gate skips no-DB build and focused tests when not applicable', () => {
  const steps = buildSiteGateSteps({
    siteKey: 'background-remover',
    profile: 'custom',
    focusedTestFiles: [],
  });

  assert.deepEqual(
    steps.map((step) => step.args),
    [['site:contract'], ['build'], ['cf:check']]
  );
});

test('site gate discovers focused product tests from domain and smoke paths', async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), 'site-gate-tests-'));
  const domainTest = path.resolve(
    rootDir,
    'src/domains/mp4-compressor/ui/mp4-compressor-workbench.test.ts'
  );
  const smokeTest = path.resolve(
    rootDir,
    'tests/smoke/mp4-compressor-assets.test.ts'
  );
  const unrelatedSmokeTest = path.resolve(
    rootDir,
    'tests/smoke/background-remover-assets.test.ts'
  );

  try {
    await mkdir(path.dirname(domainTest), { recursive: true });
    await mkdir(path.dirname(smokeTest), { recursive: true });
    await writeFile(domainTest, 'import test from "node:test";\n');
    await writeFile(smokeTest, 'import test from "node:test";\n');
    await writeFile(unrelatedSmokeTest, 'import test from "node:test";\n');

    assert.deepEqual(
      await findFocusedProductTestFiles({
        rootDir,
        siteKey: 'mp4-compressor',
      }),
      [
        'src/domains/mp4-compressor/ui/mp4-compressor-workbench.test.ts',
        'tests/smoke/mp4-compressor-assets.test.ts',
      ]
    );
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

test('site gate runs the planned commands in order', async () => {
  const calls: Array<{ command: string; args: string[]; site: string }> = [];

  await runSiteGate({
    rootDir: process.cwd(),
    siteKey: 'mp4-compressor',
    processEnv: {},
    logger: {
      log() {},
    },
    async runner(command, args, env) {
      calls.push({
        command,
        args,
        site: env.SITE,
      });
    },
  });

  assert.deepEqual(calls, [
    { command: 'pnpm', args: ['site:contract'], site: 'mp4-compressor' },
    { command: 'pnpm', args: ['build'], site: 'mp4-compressor' },
    { command: 'pnpm', args: ['cf:check'], site: 'mp4-compressor' },
    {
      command: 'pnpm',
      args: ['cf:build:no-db', '--site', 'mp4-compressor'],
      site: 'mp4-compressor',
    },
    {
      command: 'pnpm',
      args: [
        'test',
        '--',
        'src/domains/mp4-compressor/ui/mp4-compressor-workbench.test.ts',
        'tests/smoke/mp4-compressor-assets.test.ts',
      ],
      site: 'mp4-compressor',
    },
  ]);
});
