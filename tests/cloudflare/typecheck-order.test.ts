import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

function run(command: string, args: string[], env: NodeJS.ProcessEnv) {
  return spawnSync(command, args, {
    cwd: process.cwd(),
    env: { ...process.env, ...env },
    encoding: 'utf8',
  });
}

test('Cloudflare config generation does not break regular site typecheck', async () => {
  const distDir = await mkdtemp(
    path.join(os.tmpdir(), 'aooi-typecheck-order-dist-')
  );

  try {
    const cloudflareCheck = run('pnpm', ['cf:check'], {
      SITE: 'dev-local',
      AOOI_BUILD_SITE: 'dev-local',
      AOOI_DIST_DIR: distDir,
      DATABASE_URL: '',
      GOOGLE_ANALYTICS_ID: 'G-AUDIT',
      STORAGE_PUBLIC_BASE_URL: 'http://127.0.0.1:8787/assets/',
    });
    assert.equal(
      cloudflareCheck.status,
      0,
      `${cloudflareCheck.stdout}\n${cloudflareCheck.stderr}`
    );

    const typecheck = run('pnpm', ['typecheck'], {
      SITE: 'dev-local',
      AOOI_BUILD_SITE: 'dev-local',
      AOOI_DIST_DIR: distDir,
      DATABASE_URL: '',
    });
    assert.equal(
      typecheck.status,
      0,
      `${typecheck.stdout}\n${typecheck.stderr}`
    );
  } finally {
    await rm(distDir, { recursive: true, force: true });
  }
});
