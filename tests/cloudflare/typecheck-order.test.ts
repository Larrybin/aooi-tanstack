import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

function run(command: string, args: string[], env: NodeJS.ProcessEnv) {
  return spawnSync(command, args, {
    cwd: process.cwd(),
    env: { ...process.env, ...env },
    encoding: 'utf8',
  });
}

test('Cloudflare config generation does not break regular site typecheck', () => {
  const cloudflareCheck = run('pnpm', ['cf:check'], {
    SITE: 'dev-local',
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
    DATABASE_URL: '',
  });
  assert.equal(typecheck.status, 0, `${typecheck.stdout}\n${typecheck.stderr}`);
});
