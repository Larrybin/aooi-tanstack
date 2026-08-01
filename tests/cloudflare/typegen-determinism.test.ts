import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import test from 'node:test';

function runTypegen(extraEnv: NodeJS.ProcessEnv) {
  return spawnSync('pnpm', ['cf:typegen:check'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      SITE: '401k-calculator',
      DATABASE_URL: '',
      GOOGLE_ANALYTICS_ID: '',
      CLARITY_ID: '',
      PLAUSIBLE_DOMAIN: '',
      PLAUSIBLE_SRC: '',
      OPENPANEL_CLIENT_ID: '',
      ...extraEnv,
    },
    encoding: 'utf8',
  });
}

test('Cloudflare typegen check is deterministic across live analytics values', () => {
  const trackedBefore = readFileSync(
    'src/shared/types/cloudflare.d.ts',
    'utf8'
  );
  const withAnalytics = runTypegen({ GOOGLE_ANALYTICS_ID: 'G-AUDIT' });
  assert.equal(
    withAnalytics.status,
    0,
    `${withAnalytics.stdout}\n${withAnalytics.stderr}`
  );
  assert.equal(
    readFileSync('src/shared/types/cloudflare.d.ts', 'utf8'),
    trackedBefore
  );

  const withoutAnalytics = runTypegen({});
  assert.equal(
    withoutAnalytics.status,
    0,
    `${withoutAnalytics.stdout}\n${withoutAnalytics.stderr}`
  );
  assert.equal(
    readFileSync('src/shared/types/cloudflare.d.ts', 'utf8'),
    trackedBefore
  );
});
