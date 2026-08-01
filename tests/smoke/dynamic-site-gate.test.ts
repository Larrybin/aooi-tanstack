import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  listSiteKeys,
  resolveSiteCloudflareContract,
} from '../../scripts/cloudflare/contract';
import { listConfiguredSiteKeys } from '../../scripts/lib/site-config';
import { buildSiteRouteIgnorePattern } from '../../scripts/lib/site-route-assembly';
import { checkSiteContract } from '../../scripts/site-contract';
import { runSiteGate } from '../../scripts/site-gate';

test('Cloudflare site gate supplies non-sensitive fixtures for required runtime vars', async () => {
  const cases = [
    {
      siteKey: 'ai-remover',
      expected: {
        STORAGE_PUBLIC_BASE_URL: 'https://ai-remover.site-gate.invalid/assets/',
      },
    },
    {
      siteKey: 'text-to-speech-generator',
      expected: {
        STORAGE_PUBLIC_BASE_URL:
          'https://text-to-speech-generator.site-gate.invalid/assets/',
        NEXT_PUBLIC_TURNSTILE_SITE_KEY: 'site-gate-turnstile-site-key',
      },
    },
  ] as const;

  for (const { siteKey, expected } of cases) {
    const calls: Array<{
      command: string;
      args: string[];
      env: NodeJS.ProcessEnv;
    }> = [];

    await runSiteGate({
      rootDir: process.cwd(),
      siteKey,
      cloudflare: true,
      processEnv: {},
      runCommand: async (command, args, env) => {
        calls.push({ command, args, env });
      },
    });

    assert.deepEqual(
      calls.map(({ command, args }) => [command, ...args].join(' ')),
      ['pnpm site:contract', 'pnpm cf:build', 'pnpm client:boundary']
    );
    for (const { env } of calls) {
      for (const [name, value] of Object.entries(expected)) {
        assert.equal(env[name], value);
      }
    }
  }
});

test('Cloudflare site gate preserves explicit required runtime vars', async () => {
  const calls: NodeJS.ProcessEnv[] = [];
  const storagePublicBaseUrl = 'https://provided.example.test/assets/';

  await runSiteGate({
    rootDir: process.cwd(),
    siteKey: 'ai-remover',
    cloudflare: true,
    processEnv: { STORAGE_PUBLIC_BASE_URL: storagePublicBaseUrl },
    runCommand: async (_command, _args, env) => {
      calls.push(env);
    },
  });

  assert.equal(calls.length, 3);
  for (const env of calls) {
    assert.equal(env.STORAGE_PUBLIC_BASE_URL, storagePublicBaseUrl);
  }
});

test('a temporary generic site joins discovery and all local gate contracts', async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), 'aooi-dynamic-site-'));
  const siteKey = 'temporary-generic-site';
  const siteDir = path.join(rootDir, 'sites', siteKey);
  await mkdir(siteDir, { recursive: true });
  const site = {
    key: siteKey,
    domain: 'temporary.example.com',
    brand: {
      appName: 'Temporary Generic Site',
      appUrl: 'https://temporary.example.com',
      supportEmail: 'support@temporary.example.com',
      logo: '/logo.svg',
      favicon: '/logo.svg',
      previewImage: '/logo.svg',
    },
    capabilities: { enabledModules: ['analytics'], paymentProvider: 'none' },
    i18n: {
      defaultLocale: 'en',
      supportedLocales: ['en'],
      localePrefix: 'as-needed',
      localeDetection: false,
      strictPublishing: true,
    },
    configVersion: 2,
  } as const;

  await writeFile(
    path.join(siteDir, 'site.config.json'),
    `${JSON.stringify(site, null, 2)}\n`
  );
  await writeFile(
    path.join(siteDir, 'deploy.settings.json'),
    `${JSON.stringify(
      {
        configVersion: 2,
        workers: { app: 'aooi-temporary-generic-site' },
        resources: {},
      },
      null,
      2
    )}\n`
  );

  try {
    assert.deepEqual(listConfiguredSiteKeys(rootDir), [siteKey]);
    assert.deepEqual(listSiteKeys({ rootDir }), [siteKey]);

    const ignored = new RegExp(buildSiteRouteIgnorePattern({ rootDir, site }));
    assert.equal(ignored.test('(module_auth)'), true);
    assert.equal(ignored.test('(module_analytics)'), false);

    const contract = resolveSiteCloudflareContract({ rootDir, siteKey });
    assert.equal(contract.requires.database, false);
    assert.deepEqual(contract.resources, {});
    assert.deepEqual(checkSiteContract({ rootDir, siteKey }).failures, []);

    const calls: string[] = [];
    await runSiteGate({
      rootDir,
      siteKey,
      cloudflare: true,
      processEnv: {},
      runCommand: async (command, args) => {
        calls.push([command, ...args].join(' '));
      },
    });
    assert.deepEqual(calls, [
      'pnpm site:contract',
      'pnpm cf:build',
      'pnpm client:boundary',
    ]);
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});
