import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildNoDbCloudflareBuildCommandArgs,
  buildNoDbCloudflareBuildEnv,
  NO_DB_CLOUDFLARE_BUILD_SITES,
  NO_DB_CLOUDFLARE_PLACEHOLDER_ENV,
  parseNoDbCloudflareBuildCliArgs,
  runNoDbCloudflareBuilds,
} from '../../scripts/run-cf-build-no-db.mjs';
import {
  buildMultiBuildCheckArgs,
  buildOpenNextBuildArgs,
} from '../../scripts/run-cf-build.mjs';

test('cf:build 对 OpenNext 固定跳过根 wrangler config 交互检查', () => {
  assert.deepEqual(buildOpenNextBuildArgs(), [
    'exec',
    'opennextjs-cloudflare',
    'build',
    '--skipWranglerConfigCheck',
  ]);
});

test('cf:build forwards worker scope args to the dry-run upload check', () => {
  assert.deepEqual(buildMultiBuildCheckArgs(['--workers=public-web']), [
    '--import',
    'tsx',
    'scripts/run-cf-multi-build-check.mjs',
    '--workers=public-web',
  ]);
});

test('cf:build:no-db covers the explicit deployable site list', () => {
  assert.deepEqual(NO_DB_CLOUDFLARE_BUILD_SITES, ['mamamiya', 'ai-remover']);
});

test('cf:build:no-db forwards cf:build args to each site build', () => {
  assert.deepEqual(buildNoDbCloudflareBuildCommandArgs(['--workers=app']), [
    'cf:build',
    '--workers=app',
  ]);
});

test('cf:build:no-db can target one explicit matrix site', () => {
  assert.deepEqual(
    parseNoDbCloudflareBuildCliArgs([
      '--site=ai-remover',
      '--',
      '--workers=public-web',
    ]),
    {
      sites: ['ai-remover'],
      scriptArgs: ['--workers=public-web'],
    }
  );
});

test('cf:build:no-db rejects unsupported matrix sites', () => {
  assert.throws(
    () => parseNoDbCloudflareBuildCliArgs(['--site=unknown']),
    /Unsupported no-DB Cloudflare build site: unknown/
  );
});

test('cf:build:no-db clears database URLs and keeps Cloudflare build env', () => {
  const env = buildNoDbCloudflareBuildEnv('ai-remover', {
    DATABASE_URL: 'postgresql://from-shell',
    AUTH_SPIKE_DATABASE_URL: 'postgresql://auth-from-shell',
    DATABASE_PROVIDER: 'sqlite',
    DEPLOY_TARGET: 'node',
  });

  assert.equal(env.SITE, 'ai-remover');
  assert.equal(env.DATABASE_URL, '');
  assert.equal(env.AUTH_SPIKE_DATABASE_URL, '');
  assert.equal(env.DATABASE_PROVIDER, 'postgresql');
  assert.equal(env.DEPLOY_TARGET, 'cloudflare');

  for (const key of Object.keys(NO_DB_CLOUDFLARE_PLACEHOLDER_ENV)) {
    assert.equal(typeof env[key], 'string', key);
    assert.notEqual(env[key], '', key);
  }
});

test('cf:build:no-db reports all sites even when one site fails', async () => {
  const calls: string[] = [];

  const results = await runNoDbCloudflareBuilds({
    sites: ['first-site', 'second-site'],
    scriptArgs: ['--workers=public-web'],
    baseEnv: {},
    logger: {
      log() {},
      error() {},
    },
    async runSiteBuild({ site, args, env }) {
      calls.push(site);
      assert.deepEqual(args, ['cf:build', '--workers=public-web']);
      assert.equal(env.DATABASE_URL, '');

      if (site === 'first-site') {
        throw new Error('first failed');
      }
    },
  });

  assert.deepEqual(calls, ['first-site', 'second-site']);
  assert.deepEqual(results, [
    { site: 'first-site', status: 'failed', message: 'first failed' },
    { site: 'second-site', status: 'passed' },
  ]);
});
