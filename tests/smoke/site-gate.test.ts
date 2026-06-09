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

test('site gate runs the current free-tool-no-db site build without the matrix allowlist', () => {
  const steps = buildSiteGateSteps({
    siteKey: 'new-free-tool',
    profile: 'free-tool-no-db',
    focusedTestFiles: [
      'src/domains/new-free-tool/ui/new-free-tool-workbench.test.ts',
      'tests/smoke/new-free-tool-assets.test.ts',
    ],
  });

  assert.deepEqual(
    steps.map((step) => step.args),
    [
      ['site:contract'],
      ['build'],
      ['cf:check'],
      ['cf:build'],
      [
        'test',
        '--',
        'src/domains/new-free-tool/ui/new-free-tool-workbench.test.ts',
        'tests/smoke/new-free-tool-assets.test.ts',
      ],
    ]
  );

  for (const index of [2, 3]) {
    assert.equal(steps[index].env.SITE, 'new-free-tool');
    assert.equal(steps[index].env.DATABASE_URL, '');
    assert.equal(
      steps[index].env.STORAGE_PUBLIC_BASE_URL,
      'http://127.0.0.1:8787/assets/'
    );
  }
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
      args: ['cf:build'],
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
