import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { access, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const sites = ['401k-calculator', 'mp4-compressor'] as const;

function buildSite(siteKey: (typeof sites)[number]) {
  return new Promise<{ code: number; output: string }>((resolve) => {
    const child = spawn('pnpm', ['build'], {
      cwd: process.cwd(),
      env: { ...process.env, SITE: siteKey, DATABASE_URL: '' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    child.stdout.on('data', (chunk) => (output += chunk.toString()));
    child.stderr.on('data', (chunk) => (output += chunk.toString()));
    child.on('exit', (code) => resolve({ code: code ?? 1, output }));
  });
}

test('two sites build concurrently into isolated generated and dist roots', async () => {
  const statusBefore = execFileSync('git', ['status', '--porcelain=v1'], {
    encoding: 'utf8',
  });
  await Promise.all(
    sites.map((siteKey) =>
      rm(path.resolve('dist', siteKey), { recursive: true, force: true })
    )
  );

  const [calculator, mp4] = await Promise.all(sites.map(buildSite));
  assert.equal(calculator.code, 0, calculator.output);
  assert.equal(mp4.code, 0, mp4.output);

  for (const siteKey of sites) {
    const generatedSite = await readFile(
      path.resolve('.generated', 'sites', siteKey, 'site.ts'),
      'utf8'
    );
    assert.match(generatedSite, new RegExp(`"key": "${siteKey}"`));

    const serverEntry = await readFile(
      path.resolve('dist', siteKey, 'server', 'entry.server.mjs'),
      'utf8'
    );
    assert.ok(serverEntry.length > 0, `${siteKey} server output is empty`);
    await access(
      path.resolve('.generated', 'sites', siteKey, 'paraglide', 'runtime.js')
    );
  }

  const statusAfter = execFileSync('git', ['status', '--porcelain=v1'], {
    encoding: 'utf8',
  });
  assert.equal(statusAfter, statusBefore);
  await assert.rejects(access(path.resolve('.tmp', 'site-build.lockfile')));
});
