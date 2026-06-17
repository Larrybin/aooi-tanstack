import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

import { resolveSiteDeployContract } from '../../scripts/lib/site-deploy-contract.mjs';
import {
  buildRouterAppVersionIds,
  buildRouterDeployConfigContent,
  buildRouterDirectDeployArgs,
  buildVersionDeploySpecs,
  createTempDeployArtifacts,
  deployCloudflareApp,
  determineDeployMode,
  parseWranglerJsonPayload,
} from '../../scripts/run-cf-app-deploy.mjs';
import cloudflareWorkerSplits from '../../src/shared/config/cloudflare-worker-splits';

const { CLOUDFLARE_ALL_SERVER_WORKER_TARGETS, CLOUDFLARE_VERSION_ID_VARS } =
  cloudflareWorkerSplits;
const expectedStoragePublicBaseUrl =
  process.env.STORAGE_PUBLIC_BASE_URL?.trim() ?? '';
const contract = resolveSiteDeployContract({
  rootDir: process.cwd(),
  siteKey: 'mamamiya',
});

test('package cf:deploy:app 只跑 app-scoped check', async () => {
  const manifest = JSON.parse(await readFile('package.json', 'utf8')) as {
    scripts: Record<string, string>;
  };
  const command = manifest.scripts['cf:deploy:app'];

  assert.match(command, /pnpm cf:check -- --workers=app/);
  assert.match(
    command,
    /run-with-site\.mjs node --import tsx scripts\/run-cf-app-deploy\.mjs/
  );
  assert.doesNotMatch(command, /pnpm cf:check &&/);
});

test('package exposes Cloudflare preview deploy scripts', async () => {
  const manifest = JSON.parse(await readFile('package.json', 'utf8')) as {
    scripts: Record<string, string>;
  };

  assert.equal(
    manifest.scripts['cf:preview:check'],
    'CF_DEPLOY_PROFILE=preview pnpm cf:check'
  );
  assert.equal(
    manifest.scripts['cf:preview:bootstrap'],
    'CF_DEPLOY_PROFILE=preview CF_DEPLOY_BOOTSTRAP_MISSING=true pnpm cf:deploy'
  );
});

test('buildRouterDeployConfigContent 将 router 入口、assets 与 version ids 改写为部署态配置', async () => {
  const versionIds = Object.fromEntries(
    CLOUDFLARE_ALL_SERVER_WORKER_TARGETS.map((target, index) => [
      target,
      `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
    ])
  );

  const config = await buildRouterDeployConfigContent({
    contract,
    versionIds,
  });

  assert.match(
    config,
    new RegExp(
      `main = "${escapeRegExp(path.relative(path.resolve(process.cwd(), '.tmp'), path.resolve(process.cwd(), 'cloudflare/workers/router.ts')))}"`
    )
  );
  assert.match(
    config,
    new RegExp(
      `directory = "${escapeRegExp(path.relative(path.resolve(process.cwd(), '.tmp'), path.resolve(process.cwd(), 'dist/client')))}"`
    )
  );
  assert.match(
    config,
    new RegExp(
      `STORAGE_PUBLIC_BASE_URL = "${escapeRegExp(expectedStoragePublicBaseUrl)}"`
    )
  );

  for (const target of CLOUDFLARE_ALL_SERVER_WORKER_TARGETS) {
    const versionVar = CLOUDFLARE_VERSION_ID_VARS[target];
    assert.match(config, new RegExp(`${versionVar} = "${versionIds[target]}"`));
  }
});

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

test('determineDeployMode 在 router 或任一 server 缺 deployment 时标记为 missing-deployments', () => {
  const servers = Object.fromEntries(
    CLOUDFLARE_ALL_SERVER_WORKER_TARGETS.map((target) => [
      target,
      `v-${target}`,
    ])
  );

  assert.equal(
    determineDeployMode({
      router: null,
      servers,
    }),
    'missing-deployments'
  );

  assert.equal(
    determineDeployMode({
      router: 'v-router',
      servers: {
        ...servers,
        member: null,
      },
    }),
    'missing-deployments'
  );

  assert.equal(
    determineDeployMode({
      router: 'v-router',
      servers,
    }),
    'steady-state'
  );
});

test('buildVersionDeploySpecs 生成缺省版本与 steady-state 的部署顺序', () => {
  assert.deepEqual(buildVersionDeploySpecs(null, 'v-next'), ['v-next@100%']);
  assert.deepEqual(buildVersionDeploySpecs('v-current', 'v-next'), [
    'v-next@100%',
    'v-current@0%',
  ]);
});

test('buildRouterDirectDeployArgs 对 router 固定使用 wrangler deploy 与 keep-vars', () => {
  const args = buildRouterDirectDeployArgs({
    configPath: '/tmp/router.wrangler.toml',
    name: contract.router.workerName,
    secretsPath: '/tmp/router.secrets.env',
    message: 'router-direct-deploy',
  });

  assert.deepEqual(args, [
    'deploy',
    '--config',
    '/tmp/router.wrangler.toml',
    '--name',
    contract.router.workerName,
    '--message',
    'router-direct-deploy',
    '--experimental-autoconfig=false',
    '--keep-vars',
    '--secrets-file',
    '/tmp/router.secrets.env',
  ]);
  assert.equal(args.includes('versions'), false);
});

test('buildRouterDirectDeployArgs 在无 secrets 时不传 secrets-file', () => {
  const args = buildRouterDirectDeployArgs({
    configPath: '/tmp/router.wrangler.toml',
    name: contract.router.workerName,
    secretsPath: null,
    message: 'router-direct-deploy',
  });

  assert.deepEqual(args, [
    'deploy',
    '--config',
    '/tmp/router.wrangler.toml',
    '--name',
    contract.router.workerName,
    '--message',
    'router-direct-deploy',
    '--experimental-autoconfig=false',
    '--keep-vars',
  ]);
});

test('createTempDeployArtifacts 对 router 使用 router-scoped secrets', async () => {
  const previousSite = process.env.SITE;
  const previousBetterAuthSecret = process.env.BETTER_AUTH_SECRET;
  const previousAuthSecret = process.env.AUTH_SECRET;

  try {
    process.env.SITE = 'mamamiya';
    process.env.BETTER_AUTH_SECRET = 'better-secret';
    process.env.AUTH_SECRET = 'auth-secret';

    const artifacts = await createTempDeployArtifacts({
      name: contract.router.workerName,
      templatePath: path.resolve(process.cwd(), 'wrangler.cloudflare.toml'),
      workerKeys: ['router'],
      contract,
    });

    try {
      const secrets = await readFile(artifacts.secretsFilePath, 'utf8');
      assert.equal(secrets, '\n');
      assert.equal(artifacts.secretsPath, null);
      assert.doesNotMatch(secrets, /BETTER_AUTH_SECRET|AUTH_SECRET/);
    } finally {
      await artifacts.cleanup();
    }
  } finally {
    if (previousSite === undefined) {
      delete process.env.SITE;
    } else {
      process.env.SITE = previousSite;
    }
    if (previousBetterAuthSecret === undefined) {
      delete process.env.BETTER_AUTH_SECRET;
    } else {
      process.env.BETTER_AUTH_SECRET = previousBetterAuthSecret;
    }
    if (previousAuthSecret === undefined) {
      delete process.env.AUTH_SECRET;
    } else {
      process.env.AUTH_SECRET = previousAuthSecret;
    }
  }
});

test('createTempDeployArtifacts 对 server worker 使用单 worker secrets scope', async () => {
  const previousSite = process.env.SITE;
  const previousBetterAuthSecret = process.env.BETTER_AUTH_SECRET;
  const previousAuthSecret = process.env.AUTH_SECRET;
  const previousResendApiKey = process.env.RESEND_API_KEY;

  try {
    process.env.SITE = 'mamamiya';
    process.env.BETTER_AUTH_SECRET = 'better-secret';
    process.env.RESEND_API_KEY = 'resend-key';
    delete process.env.AUTH_SECRET;

    const artifacts = await createTempDeployArtifacts({
      name: contract.serverWorkers.auth.workerName,
      templatePath: path.resolve(
        process.cwd(),
        'cloudflare/wrangler.server-auth.toml'
      ),
      workerKeys: ['auth'],
      contract,
    });

    try {
      const secrets = await readFile(artifacts.secretsPath, 'utf8');
      assert.equal(
        secrets,
        [
          'BETTER_AUTH_SECRET=better-secret',
          'AUTH_SECRET=better-secret',
          'RESEND_API_KEY=resend-key',
          '',
        ].join('\n')
      );
    } finally {
      await artifacts.cleanup();
    }
  } finally {
    if (previousSite === undefined) {
      delete process.env.SITE;
    } else {
      process.env.SITE = previousSite;
    }
    if (previousBetterAuthSecret === undefined) {
      delete process.env.BETTER_AUTH_SECRET;
    } else {
      process.env.BETTER_AUTH_SECRET = previousBetterAuthSecret;
    }
    if (previousAuthSecret === undefined) {
      delete process.env.AUTH_SECRET;
    } else {
      process.env.AUTH_SECRET = previousAuthSecret;
    }
    if (previousResendApiKey === undefined) {
      delete process.env.RESEND_API_KEY;
    } else {
      process.env.RESEND_API_KEY = previousResendApiKey;
    }
  }
});

test('buildRouterAppVersionIds 先保留当前 server 版本，再切到新 server 版本', () => {
  const currentVersions = {
    router: 'router-current',
    servers: Object.fromEntries(
      CLOUDFLARE_ALL_SERVER_WORKER_TARGETS.map((target) => [
        target,
        `current-${target}`,
      ])
    ),
  };
  const nextVersions = Object.fromEntries(
    CLOUDFLARE_ALL_SERVER_WORKER_TARGETS.map((target) => [
      target,
      `next-${target}`,
    ])
  );

  assert.deepEqual(buildRouterAppVersionIds(currentVersions, nextVersions), {
    compatibility: Object.fromEntries(
      CLOUDFLARE_ALL_SERVER_WORKER_TARGETS.map((target) => [
        target,
        `current-${target}`,
      ])
    ),
    target: Object.fromEntries(
      CLOUDFLARE_ALL_SERVER_WORKER_TARGETS.map((target) => [
        target,
        `next-${target}`,
      ])
    ),
  });
});

test('parseWranglerJsonPayload 能从 wrangler 前置日志中提取 JSON', () => {
  const payload = parseWranglerJsonPayload(`
Proxy environment variables detected. We'll use your proxy for fetch requests.
[
  {
    "name": "BETTER_AUTH_SECRET",
    "type": "secret_text"
  }
]
`);

  assert.deepEqual(payload, [
    {
      name: 'BETTER_AUTH_SECRET',
      type: 'secret_text',
    },
  ]);
});

test('deployCloudflareApp 在 steady-state 时走 app rollout 分支', async () => {
  const calls: Array<['steady-state', unknown, unknown]> = [];

  await deployCloudflareApp({
    async assertBuildArtifactsReadyImpl() {},
    contract,
    async collectCurrentVersionsImpl() {
      return {
        router: 'router-v1',
        servers: Object.fromEntries(
          CLOUDFLARE_ALL_SERVER_WORKER_TARGETS.map((target) => [
            target,
            `v-${target}`,
          ])
        ),
      };
    },
    async deploySteadyStateImpl(currentVersions, resolvedContract) {
      calls.push(['steady-state', currentVersions, resolvedContract]);
    },
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], 'steady-state');
  assert.equal(calls[0][2], contract);
});

test('deployCloudflareApp 在缺少部署版本时直接失败并要求先跑 state deploy', async () => {
  await assert.rejects(
    () =>
      deployCloudflareApp({
        async assertBuildArtifactsReadyImpl() {},
        contract,
        async collectCurrentVersionsImpl() {
          return {
            router: null,
            servers: Object.fromEntries(
              CLOUDFLARE_ALL_SERVER_WORKER_TARGETS.map((target) => [
                target,
                null,
              ])
            ),
          };
        },
        async deploySteadyStateImpl() {
          throw new Error('should not reach steady-state deploy');
        },
      }),
    /Run "pnpm cf:deploy:state" first, then run "pnpm cf:deploy:app" or "pnpm cf:deploy"/i
  );
});

test('deployCloudflareApp 在 production 下禁止 bootstrap missing app workers', async () => {
  await assert.rejects(
    () =>
      deployCloudflareApp({
        async assertBuildArtifactsReadyImpl() {},
        contract,
        processEnv: {
          CF_DEPLOY_BOOTSTRAP_MISSING: 'true',
        },
        async collectCurrentVersionsImpl() {
          throw new Error('should not inspect current versions');
        },
      }),
    /only allowed with CF_DEPLOY_PROFILE=preview/i
  );
});

test('deployCloudflareApp 在 preview bootstrap flag 下初始化缺失 app workers', async () => {
  const calls: Array<['bootstrap', unknown]> = [];
  const previewContract = {
    ...contract,
    deployProfile: 'preview',
  };

  await deployCloudflareApp({
    async assertBuildArtifactsReadyImpl() {},
    contract: previewContract,
    processEnv: {
      CF_DEPLOY_BOOTSTRAP_MISSING: 'true',
    },
    async collectCurrentVersionsImpl() {
      return {
        router: null,
        servers: Object.fromEntries(
          CLOUDFLARE_ALL_SERVER_WORKER_TARGETS.map((target) => [target, null])
        ),
      };
    },
    async deployInitialAppTopologyImpl(resolvedContract) {
      calls.push(['bootstrap', resolvedContract]);
    },
    async deploySteadyStateImpl() {
      throw new Error('should not reach steady-state deploy');
    },
  });

  assert.deepEqual(calls, [['bootstrap', previewContract]]);
});

test('deployCloudflareApp 在 preview 但没有 bootstrap flag 时仍要求已有 workers', async () => {
  await assert.rejects(
    () =>
      deployCloudflareApp({
        async assertBuildArtifactsReadyImpl() {},
        contract: {
          ...contract,
          deployProfile: 'preview',
        },
        processEnv: {},
        async collectCurrentVersionsImpl() {
          return {
            router: null,
            servers: Object.fromEntries(
              CLOUDFLARE_ALL_SERVER_WORKER_TARGETS.map((target) => [
                target,
                null,
              ])
            ),
          };
        },
      }),
    /Run "pnpm cf:preview:deploy:state" first, then run "pnpm cf:preview:bootstrap"/i
  );
});

test('deployCloudflareApp 在构建产物缺失时直接失败，不读取部署状态', async () => {
  let collected = false;

  await assert.rejects(
    deployCloudflareApp({
      contract,
      async assertBuildArtifactsReadyImpl() {
        throw new Error('Run `pnpm cf:build` first');
      },
      async collectCurrentVersionsImpl() {
        collected = true;
        return {
          router: null,
          servers: Object.fromEntries(
            CLOUDFLARE_ALL_SERVER_WORKER_TARGETS.map((target) => [target, null])
          ),
        };
      },
    }),
    /pnpm cf:build/
  );

  assert.equal(collected, false);
});
