import assert from 'node:assert/strict';
import { mkdtemp, readdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { ensureCiDevVars } from '../../scripts/lib/cloudflare-preview-smoke.mjs';
import {
  CLOUDFLARE_SECRET_ENV_KEYS,
  findUnknownPublicEnvKeys,
  parseEnvAssignments,
} from '../../src/config/env-contract';

const rootDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..'
);
const PROCESS_ENV_ALLOWLIST = new Set([
  'cloudflare/workers/create-server-worker.ts',
  'src/config/env-contract.ts',
  'src/config/load-dotenv.ts',
  'src/config/public-env.ts',
  'src/config/server-auth-base-url.ts',
  'src/infra/adapters/db/config.ts',
  'src/infra/runtime/env.server.ts',
]);

async function collectFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const absolutePath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(absolutePath)));
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    files.push(absolutePath);
  }

  return files;
}

function toRepoPath(absolutePath: string): string {
  return path.relative(rootDir, absolutePath).replaceAll(path.sep, '/');
}

test('.env.example 中的 secret 占位必须为空字符串', async () => {
  const envExamplePath = path.join(rootDir, '.env.example');
  const content = await readFile(envExamplePath, 'utf8');
  const entries = parseEnvAssignments(content);

  for (const key of CLOUDFLARE_SECRET_ENV_KEYS) {
    assert.equal(entries[key], '', `${key} in .env.example 必须是空占位`);
  }
});

test('NEXT_PUBLIC_* 必须先登记到 env 契约', async () => {
  const scanTargets = [
    path.join(rootDir, '.env.example'),
    path.join(rootDir, 'README.md'),
    path.join(rootDir, 'cloudflare'),
    path.join(rootDir, 'scripts'),
    path.join(rootDir, 'src'),
  ];
  const keys = new Set<string>();

  for (const target of scanTargets) {
    const statFiles =
      path.extname(target) === '' ? await collectFiles(target) : [target];

    for (const filePath of statFiles) {
      const content = await readFile(filePath, 'utf8');
      const matches = content.match(/\bNEXT_PUBLIC_[A-Z0-9_]+\b/g) || [];
      for (const match of matches) {
        keys.add(match);
      }
    }
  }

  assert.deepEqual(findUnknownPublicEnvKeys(keys), []);
});

test('非白名单运行时代码不得直接访问或传播 process.env', async () => {
  const scanRoots = [
    path.join(rootDir, 'cloudflare'),
    path.join(rootDir, 'src'),
  ];
  const offenders: string[] = [];

  for (const scanRoot of scanRoots) {
    const files = await collectFiles(scanRoot);

    for (const filePath of files) {
      const repoPath = toRepoPath(filePath);
      if (
        repoPath.endsWith('.d.ts') ||
        repoPath.includes('.test.') ||
        repoPath.includes('.spec.')
      ) {
        continue;
      }

      if (!/\.(ts|tsx|mts|cts)$/.test(repoPath)) {
        continue;
      }

      if (PROCESS_ENV_ALLOWLIST.has(repoPath)) {
        continue;
      }

      const content = await readFile(filePath, 'utf8');
      if (/\bprocess\.env\b/.test(content)) {
        offenders.push(repoPath);
      }
    }
  }

  assert.deepEqual(offenders, []);
});

test('.dev.vars 的生成/复用逻辑只允许输出 allowlist 内键', async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'env-contract-'));
  const devVarsPath = path.join(tmpDir, '.dev.vars');
  const originalContent = 'FOO=bar\nAUTH_SECRET=\n';

  await writeFile(devVarsPath, originalContent, 'utf8');

  await assert.rejects(
    () =>
      ensureCiDevVars({
        authSecret: 'preview-secret',
        devVarsPath,
      }),
    /unsupported keys: FOO/i
  );

  const nextContent = await readFile(devVarsPath, 'utf8');
  assert.equal(nextContent, originalContent);
});
