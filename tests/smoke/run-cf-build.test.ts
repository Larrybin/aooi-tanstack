import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { resolveSiteDeployContract } from '../../scripts/lib/site-deploy-contract.mjs';
import {
  resolveSiteRoutePrunePaths,
  withSiteRoutePruning,
} from '../../scripts/lib/site-route-pruning.mjs';
import {
  buildNoDbCloudflareBuildCommandArgs,
  buildNoDbCloudflareBuildEnv,
  NO_DB_CLOUDFLARE_BUILD_SITES,
  NO_DB_CLOUDFLARE_PLACEHOLDER_ENV,
  parseNoDbCloudflareBuildCliArgs,
  runNoDbCloudflareBuilds,
} from '../../scripts/run-cf-build-no-db.mjs';
import {
  buildI18nCheckArgs,
  buildMultiBuildCheckArgs,
  buildNativeTanStackBuildArgs,
  isStrictI18nPublishingEnabled,
} from '../../scripts/run-cf-build.mjs';

test('cf:build uses the native TanStack Vite build entry', () => {
  assert.deepEqual(buildNativeTanStackBuildArgs(), [
    'exec',
    'vite',
    'build',
    '--config',
    'vite.config.mts',
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

test('cf:build runs non-strict i18n check before site publishing enforcement', () => {
  assert.equal(
    isStrictI18nPublishingEnabled({
      key: 'ai-remover',
      i18n: { strictPublishing: false },
    }),
    false
  );
  assert.deepEqual(
    buildI18nCheckArgs({
      key: 'ai-remover',
      i18n: { strictPublishing: false },
    }),
    ['scripts/check-site-i18n.mjs', '--site', 'ai-remover']
  );
});

test('cf:build runs strict i18n check after site publishing enforcement', () => {
  assert.equal(
    isStrictI18nPublishingEnabled({
      key: 'ai-remover',
      i18n: { strictPublishing: true },
    }),
    true
  );
  assert.deepEqual(
    buildI18nCheckArgs({
      key: 'ai-remover',
      i18n: { strictPublishing: true },
    }),
    ['scripts/check-site-i18n.mjs', '--site', 'ai-remover', '--strict']
  );
});

test('cf:build:no-db covers the explicit deployable site list', () => {
  assert.deepEqual(NO_DB_CLOUDFLARE_BUILD_SITES, [
    'dev-local',
  'mamamiya',
    'ai-remover',
    'background-remover',
    'text-to-speech-generator',
    'mp4-compressor',
  ]);
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

test('cf:build prunes disabled free tool routes only during native build', async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), 'site-route-prune-'));
  const prunedRoute = 'src/app/api/auth';
  const prunedRouteFile = path.join(prunedRoute, 'route.ts');
  const keptRoute = 'src/app/[locale]/(landing)';
  const prunedFile = path.join(rootDir, prunedRouteFile);
  const keptFile = path.join(rootDir, keptRoute, 'page.tsx');

  await mkdir(path.dirname(prunedFile), { recursive: true });
  await mkdir(path.dirname(keptFile), { recursive: true });
  await writeFile(prunedFile, 'export const GET = () => new Response();\n');
  await writeFile(
    keptFile,
    'export default function Page() { return null; }\n'
  );

  const contract = {
    site: {
      key: 'mp4-compressor',
      capabilities: {
        auth: false,
        payment: 'none',
        ai: false,
        docs: false,
        blog: false,
      },
    },
    bindingRequirements: {
      bindings: {
        hyperdrive: false,
      },
    },
  };

  try {
    assert.ok(resolveSiteRoutePrunePaths(contract).includes(prunedRoute));

    await withSiteRoutePruning({
      rootDir,
      contract,
      logger: {
        log() {},
      },
      async task() {
        assert.equal(existsSync(path.join(rootDir, prunedRoute)), true);
        assert.equal(existsSync(path.join(rootDir, prunedRouteFile)), false);
        assert.equal(existsSync(path.join(rootDir, keptRoute)), true);
      },
    });

    assert.equal(existsSync(path.join(rootDir, prunedRoute)), true);
    assert.equal(existsSync(path.join(rootDir, prunedRouteFile)), true);
    assert.equal(existsSync(path.join(rootDir, keptRoute)), true);
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

test('cf:build keeps SaaS routes when auth or Hyperdrive is enabled', async () => {
  assert.deepEqual(
    resolveSiteRoutePrunePaths({
      site: {
        key: 'background-remover',
        capabilities: {
          auth: true,
          payment: 'creem',
          ai: false,
          docs: false,
          blog: false,
        },
      },
      bindingRequirements: {
        bindings: {
          hyperdrive: true,
        },
      },
    }),
    []
  );
});

test('cf:build real public-only free tool topology must prune disabled SaaS routes', () => {
  const contract = resolveSiteDeployContract({
    siteKey: 'mp4-compressor',
    processEnv: {},
  });
  const prunePaths = resolveSiteRoutePrunePaths(contract);

  assert.deepEqual(Object.keys(contract.serverWorkers), ['public-web']);
  assert.ok(prunePaths.includes('src/app/api/auth'));
  assert.ok(prunePaths.includes('src/app/api/config'));
  assert.ok(prunePaths.includes('src/app/[locale]/(admin)'));
  assert.ok(prunePaths.includes('src/app/[locale]/(landing)/settings'));
  assert.ok(prunePaths.includes('src/app/[locale]/(landing)/blog'));
});

test('cf:build real SaaS topology keeps split-worker routes available', () => {
  const contract = resolveSiteDeployContract({
    siteKey: 'background-remover',
    processEnv: {},
  });

  assert.deepEqual(Object.keys(contract.serverWorkers), [
    'public-web',
    'auth',
    'payment',
    'member',
    'admin',
  ]);
  assert.deepEqual(resolveSiteRoutePrunePaths(contract), []);
});
