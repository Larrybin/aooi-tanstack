import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  classifyChangedPaths,
  createDetectionReport,
  EMPTY_TREE_SHA,
  resolveBaseSha,
  writeGithubOutputs,
} from '../../scripts/detect-cloudflare-acceptance-changes.mjs';

test('detect acceptance changes ignores unrelated docs-only edits', () => {
  assert.deepEqual(
    classifyChangedPaths(['README.md', 'docs/guides/database.md']),
    {
      cloudflareChanged: false,
      contractAiRemoverChanged: false,
    }
  );
});

test('detect acceptance changes marks Cloudflare and source paths', () => {
  assert.deepEqual(classifyChangedPaths(['cloudflare/workers/router.ts']), {
    cloudflareChanged: true,
    contractAiRemoverChanged: false,
  });
  assert.deepEqual(classifyChangedPaths(['src/app/api/health/route.ts']), {
    cloudflareChanged: true,
    contractAiRemoverChanged: false,
  });
});

test('detect acceptance changes marks AI Remover contract paths separately', () => {
  assert.deepEqual(
    classifyChangedPaths(['docs/product/ai-remover/deployment-setup.md']),
    {
      cloudflareChanged: false,
      contractAiRemoverChanged: true,
    }
  );
  assert.deepEqual(
    classifyChangedPaths(['sites/ai-remover/site.config.json']),
    {
      cloudflareChanged: true,
      contractAiRemoverChanged: true,
    }
  );
});

test('detect acceptance changes marks AI Remover contract source-map paths', () => {
  const contractPaths = [
    'src/app/[locale]/(admin)/admin/credits/page.tsx',
    'src/app/api/ai/generate/create-handler.ts',
    'src/app/api/ai/notify/signature.ts',
    'src/domains/remover/application/jobs.ts',
    'src/app/api/remover/jobs/action.ts',
    'src/domains/billing/application/flows.ts',
    'src/domains/account/application/use-cases.ts',
    'src/domains/ai/application/service.ts',
    'src/domains/settings/application/settings-runtime.contracts.ts',
    'src/domains/settings/definitions/payment.ts',
    'src/extensions/ai/providers.ts',
    'src/infra/runtime/env.server.ts',
    'src/surfaces/admin/schemas/list/credits.ts',
    'src/config/db/schema.ts',
    'src/config/db/migrations/0006_ai_remover_jobs.sql',
    'src/config/env-contract.ts',
  ];

  for (const changedPath of contractPaths) {
    assert.deepEqual(classifyChangedPaths([changedPath]), {
      cloudflareChanged: true,
      contractAiRemoverChanged: true,
    });
  }

  assert.deepEqual(
    classifyChangedPaths(['tests/contract/payment-notify.test.ts']),
    {
      cloudflareChanged: false,
      contractAiRemoverChanged: true,
    }
  );
});

test('detect acceptance changes forces all checks on workflow_dispatch', () => {
  assert.deepEqual(
    createDetectionReport({
      eventName: 'workflow_dispatch',
      changedPaths: [],
    }),
    {
      cloudflareChanged: true,
      contractAiRemoverChanged: true,
      changedPathCount: 0,
      reason: 'workflow_dispatch',
    }
  );
});

test('resolveBaseSha falls back deterministically for missing or all-zero base sha', async () => {
  const resolved = await resolveBaseSha({
    baseSha: '0000000000000000000000000000000000000000',
    headSha: 'HEAD',
    execFileImpl: async () => {
      throw new Error('no parent');
    },
  });

  assert.equal(resolved, EMPTY_TREE_SHA);
});

test('writeGithubOutputs writes stable boolean outputs', async () => {
  const tempDir = await mkdtemp(path.join(tmpdir(), 'detect-cf-outputs-'));
  const outputPath = path.join(tempDir, 'github-output');

  try {
    await writeGithubOutputs(
      {
        cloudflareChanged: true,
        contractAiRemoverChanged: false,
        changedPathCount: 2,
        reason: 'changed_paths',
      },
      outputPath
    );

    assert.equal(
      await readFile(outputPath, 'utf8'),
      [
        'cloudflare_changed=true',
        'contract_ai_remover_changed=false',
        'changed_path_count=2',
        'reason=changed_paths',
        '',
      ].join('\n')
    );
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
