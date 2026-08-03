import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { rm } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';

import {
  buildSiteEnv,
  requiresContentGeneration,
  requiresRouteGeneration,
} from '../../scripts/run-with-site.ts';

const execFileAsync = promisify(execFile);
const generatedDir = path.resolve(
  process.cwd(),
  '.generated',
  `run-with-site-test-${process.pid}`
);

test.after(async () => {
  await rm(generatedDir, { recursive: true, force: true });
});

async function runWithSite(
  args: string[],
  env: Partial<NodeJS.ProcessEnv> = {}
) {
  try {
    const result = await execFileAsync(
      process.execPath,
      ['--import', 'tsx', 'scripts/run-with-site.ts', ...args],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          AOOI_GENERATED_DIR: generatedDir,
          ...env,
        },
      }
    );

    return {
      ok: true as const,
      stdout: result.stdout,
      stderr: result.stderr,
    };
  } catch (error) {
    const execError = error as {
      stdout?: string;
      stderr?: string;
      code?: number;
    };

    return {
      ok: false as const,
      stdout: execError.stdout ?? '',
      stderr: execError.stderr ?? '',
      code: execError.code,
    };
  }
}

test('run-with-site 对 Vite production build/preview 要求显式 SITE', async () => {
  for (const command of [
    ['pnpm', 'exec', 'vite', 'build', '--config', 'vite.config.mts'],
    ['pnpm', 'exec', 'vite', 'preview', '--config', 'vite.config.mts'],
  ]) {
    const result = await runWithSite(command, { SITE: '' });

    assert.equal(result.ok, false);
    assert.match(result.stderr, /SITE is required for this command/);
    assert.match(result.stderr, /pnpm exec vite/);
  }
});

test('run-with-site 对 Cloudflare smoke 命令要求显式 SITE', async () => {
  const result = await runWithSite(
    ['node', '--import', 'tsx', 'scripts/smoke.mjs', 'cf-local'],
    {
      SITE: '',
    }
  );

  assert.equal(result.ok, false);
  assert.match(result.stderr, /SITE is required for this command/);
  assert.match(result.stderr, /scripts\/smoke\.mjs cf-local/);
});

test('run-with-site 对 Cloudflare deploy 命令要求显式 SITE', async () => {
  const result = await runWithSite(
    ['pnpm', 'exec', 'tsx', 'scripts/cloudflare.ts', 'check'],
    { SITE: '' }
  );

  assert.equal(result.ok, false);
  assert.match(result.stderr, /SITE is required for this command/);
  assert.match(result.stderr, /scripts\/cloudflare\.ts check/);
});

test('run-with-site regenerates content for TanStack commands', () => {
  assert.equal(
    requiresContentGeneration(['pnpm', 'exec', 'vite', 'build']),
    true
  );
  assert.equal(
    requiresContentGeneration(['pnpm', 'exec', 'tsc', '--noEmit']),
    true
  );
  assert.equal(
    requiresContentGeneration(['pnpm', 'exec', 'tsx', 'scripts/run-tests.ts']),
    true
  );
  assert.equal(
    requiresContentGeneration(['pnpm', 'exec', 'eslint', '.']),
    false
  );
});

test('run-with-site generates route trees for build and typecheck commands', () => {
  assert.equal(
    requiresRouteGeneration(['pnpm', 'exec', 'vite', 'build']),
    true
  );
  assert.equal(
    requiresRouteGeneration(['pnpm', 'exec', 'tsc', '--noEmit']),
    true
  );
  assert.equal(
    requiresRouteGeneration(['pnpm', 'exec', 'vite', 'preview']),
    false
  );
});

test('run-with-site derives isolated paths for each selected site', () => {
  const calculator = buildSiteEnv(
    ['pnpm', 'exec', 'vite', 'build'],
    { SITE: '401k-calculator' },
    { originalEnv: { SITE: '401k-calculator' }, rootDir: '/repo' }
  );
  const mp4 = buildSiteEnv(
    ['pnpm', 'exec', 'vite', 'build'],
    { SITE: 'mp4-compressor' },
    { originalEnv: { SITE: 'mp4-compressor' }, rootDir: '/repo' }
  );

  assert.equal(
    calculator.AOOI_GENERATED_DIR,
    '/repo/.generated/sites/401k-calculator'
  );
  assert.equal(calculator.AOOI_DIST_DIR, '/repo/dist/401k-calculator');
  assert.equal(mp4.AOOI_GENERATED_DIR, '/repo/.generated/sites/mp4-compressor');
  assert.equal(mp4.AOOI_DIST_DIR, '/repo/dist/mp4-compressor');
  assert.notEqual(calculator.AOOI_GENERATED_DIR, mp4.AOOI_GENERATED_DIR);
});

test('run-with-site 对 lint 使用内部 dev-local site fallback', async () => {
  const result = await runWithSite(
    [
      'node',
      '-p',
      '\'JSON.stringify({site: process.env.SITE || "", authSecret: process.env.BETTER_AUTH_SECRET || process.env.AUTH_SECRET || "", storagePublicBaseUrl: process.env.STORAGE_PUBLIC_BASE_URL || ""})\'',
    ],
    {
      SITE: '',
      AUTH_SECRET: '',
      BETTER_AUTH_SECRET: '',
      STORAGE_PUBLIC_BASE_URL: '',
    }
  );

  assert.equal(result.ok, true, result.stderr);
  assert.match(result.stdout, /\[site\] generated dev-local/);
  assert.equal(
    result.stdout.trimEnd().split('\n').at(-1),
    JSON.stringify({
      site: 'dev-local',
      authSecret: 'dev-local-auth-secret-dev-local-auth-secret',
      storagePublicBaseUrl: 'http://127.0.0.1:9787/assets/',
    })
  );
});

test('run-with-site 尊重显式 SITE', async () => {
  const result = await runWithSite(['node', '-p', 'process.env.SITE || ""'], {
    SITE: 'mamamiya',
  });

  assert.equal(result.ok, true, result.stderr);
  assert.match(result.stdout, /\[site\] generated mamamiya/);
  assert.equal(result.stdout.trimEnd().split('\n').at(-1), 'mamamiya');
});

test('run-with-site buildSiteEnv applies selected site local env without overriding shell env', () => {
  const env = {
    SITE: 'ai-remover',
    DATABASE_URL: 'postgresql://root-db',
    CREEM_API_KEY: 'shell-creem',
  };
  const originalEnv = {
    SITE: 'ai-remover',
    CREEM_API_KEY: 'shell-creem',
  };

  const result = buildSiteEnv(['node', '-p', 'process.env.DATABASE_URL'], env, {
    originalEnv,
    rootDir: '/repo',
    readFileSyncImpl() {
      return `
DATABASE_URL=postgresql://site-db
CREEM_API_KEY=site-creem
REMOVER_AI_PROVIDER=cloudflare-workers-ai
`;
    },
  });

  assert.equal(result.SITE, 'ai-remover');
  assert.equal(result.DATABASE_URL, 'postgresql://site-db');
  assert.equal(result.CREEM_API_KEY, 'shell-creem');
  assert.equal(result.REMOVER_AI_PROVIDER, 'cloudflare-workers-ai');
});

test('run-with-site keeps explicit empty database URLs across site env overlay', () => {
  const env = {
    SITE: 'ai-remover',
    DATABASE_URL: '',
    AUTH_SPIKE_DATABASE_URL: '',
  };
  const originalEnv = {
    SITE: 'ai-remover',
    DATABASE_URL: '',
    AUTH_SPIKE_DATABASE_URL: '',
  };

  const result = buildSiteEnv(['pnpm', 'cf:build'], env, {
    originalEnv,
    rootDir: '/repo',
    readFileSyncImpl() {
      return `
DATABASE_URL=postgresql://site-db
AUTH_SPIKE_DATABASE_URL=postgresql://site-auth-db
REMOVER_AI_PROVIDER=cloudflare-workers-ai
`;
    },
  });

  assert.equal(result.SITE, 'ai-remover');
  assert.equal(result.DATABASE_URL, '');
  assert.equal(result.AUTH_SPIKE_DATABASE_URL, '');
  assert.equal(result.REMOVER_AI_PROVIDER, 'cloudflare-workers-ai');
});

test('run-with-site 对未知 SITE 输出可修复的配置错误', async () => {
  const result = await runWithSite(['node', '-p', 'process.env.SITE || ""'], {
    SITE: '__missing_site__',
  });

  assert.equal(result.ok, false);
  assert.match(result.stderr, /site "__missing_site__" is not configured/);
  assert.match(
    result.stderr,
    /missing sites\/__missing_site__\/site\.config\.json/
  );
  assert.match(
    result.stderr,
    /set SITE to one of: 401k-calculator, ai-remover, anagram-generator, background-remover, dev-local, mamamiya, mp4-compressor, random-group-generator, text-to-speech-generator/
  );
  assert.doesNotMatch(result.stderr, /ENOENT/);
  assert.doesNotMatch(result.stderr, /Error: site "__missing_site__"/);
  assert.doesNotMatch(result.stderr, /at readCurrentSiteConfig/);
});
