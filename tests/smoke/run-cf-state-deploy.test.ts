import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  getRequiredCloudflareBuildArtifactPaths,
  getRequiredCloudflareStateBuildArtifactPaths,
} from '../../scripts/lib/cloudflare-build-artifacts.mjs';
import {
  buildStateDeployWranglerArgs,
  deployCloudflareState,
} from '../../scripts/run-cf-state-deploy.mjs';

test('package cf:deploy:state 只跑 state-scoped check 且不串完整 cf:build', async () => {
  const manifest = JSON.parse(await readFile('package.json', 'utf8')) as {
    scripts: Record<string, string>;
  };
  const command = manifest.scripts['cf:deploy:state'];

  assert.match(command, /check-cloudflare-config\.mjs --workers=state/);
  assert.match(
    command,
    /run-with-site\.mjs node --import tsx scripts\/run-cf-state-deploy\.mjs/
  );
  assert.doesNotMatch(command, /pnpm cf:check(?!-)/);
  assert.doesNotMatch(command, /pnpm cf:build/);
});

test('buildStateDeployWranglerArgs 固定使用 wrangler deploy 与 keep-vars', () => {
  const args = buildStateDeployWranglerArgs({
    name: 'site-state-worker',
    configPath: '/tmp/wrangler.state.toml',
    secretsPath: '/tmp/cloudflare.secrets.env',
    message: 'state-message',
  });

  assert.deepEqual(args, [
    'deploy',
    '--config',
    '/tmp/wrangler.state.toml',
    '--name',
    'site-state-worker',
    '--message',
    'state-message',
    '--experimental-autoconfig=false',
    '--keep-vars',
    '--secrets-file',
    '/tmp/cloudflare.secrets.env',
  ]);
  assert.equal(args.includes('versions'), false);
});

test('state deploy artifact guard 只检查 state worker 直接依赖的 native worker 产物', () => {
  const stateArtifacts = getRequiredCloudflareStateBuildArtifactPaths();
  const appArtifacts = getRequiredCloudflareBuildArtifactPaths({
    SITE: 'mamamiya',
  });

  assert.deepEqual(stateArtifacts, [
    'cloudflare/workers/state.ts',
    'cloudflare/workers/stateful-limiters.ts',
  ]);
  assert.ok(appArtifacts.includes('dist/server/server.mjs'));
  assert.ok(appArtifacts.includes('dist/client'));
  assert.equal(
    stateArtifacts.some((artifact) => artifact.startsWith('dist/')),
    false
  );
});

test('buildStateDeployWranglerArgs 在无 secrets 时不传 secrets-file', () => {
  const args = buildStateDeployWranglerArgs({
    name: 'site-state-worker',
    configPath: '/tmp/wrangler.state.toml',
    secretsPath: null,
    message: 'state-message',
  });

  assert.deepEqual(args, [
    'deploy',
    '--config',
    '/tmp/wrangler.state.toml',
    '--name',
    'site-state-worker',
    '--message',
    'state-message',
    '--experimental-autoconfig=false',
    '--keep-vars',
  ]);
});

test('deployCloudflareState 只走 wrangler deploy 并在成功后 cleanup', async () => {
  const calls: string[][] = [];
  let cleanedUp = false;

  await deployCloudflareState({
    async assertBuildArtifactsReadyImpl() {},
    async createArtifacts() {
      return {
        workerName: 'site-state-worker',
        configPath: '/tmp/wrangler.state.toml',
        secretsPath: '/tmp/cloudflare.secrets.env',
        async cleanup() {
          cleanedUp = true;
        },
      };
    },
    async runWranglerCommand(args) {
      calls.push(args);
      return { stdout: '', stderr: '' };
    },
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], 'deploy');
  assert.equal(calls[0].includes('versions'), false);
  assert.equal(cleanedUp, true);
});

test('deployCloudflareState 在 wrangler 失败时仍会 cleanup', async () => {
  let cleanedUp = false;

  await assert.rejects(
    deployCloudflareState({
      async assertBuildArtifactsReadyImpl() {},
      async createArtifacts() {
        return {
          workerName: 'site-state-worker',
          configPath: '/tmp/wrangler.state.toml',
          secretsPath: '/tmp/cloudflare.secrets.env',
          async cleanup() {
            cleanedUp = true;
          },
        };
      },
      async runWranglerCommand() {
        throw new Error('deploy failed');
      },
    }),
    /deploy failed/
  );

  assert.equal(cleanedUp, true);
});

test('deployCloudflareState 在构建产物缺失时直接失败，不调用 wrangler', async () => {
  let calledWrangler = false;

  await assert.rejects(
    deployCloudflareState({
      async assertBuildArtifactsReadyImpl() {
        throw new Error('Run `pnpm cf:build` first');
      },
      async createArtifacts() {
        throw new Error('should not create artifacts');
      },
      async runWranglerCommand() {
        calledWrangler = true;
        return { stdout: '', stderr: '' };
      },
    }),
    /pnpm cf:build/
  );

  assert.equal(calledWrangler, false);
});
