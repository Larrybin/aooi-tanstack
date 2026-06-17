import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  assertCloudflareLocalBuildArtifactsReady,
  findAvailablePort,
  prepareCloudflareLocalTopologyArtifacts,
  startCloudflareLocalDevTopology,
} from '../../scripts/lib/cloudflare-local-topology.mjs';
import cloudflareWorkerSplits from '../../src/shared/config/cloudflare-worker-splits';

const { CLOUDFLARE_ALL_SERVER_WORKER_TARGETS } = cloudflareWorkerSplits;

test('findAvailablePort 会跳过仅占用 127.0.0.1 的端口', async () => {
  const server = net.createServer();

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve());
  });

  try {
    const address = server.address();
    assert.ok(address && typeof address === 'object');

    const nextPort = await findAvailablePort(address.port);
    assert.notEqual(nextPort, address.port);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  }
});

test('assertCloudflareLocalBuildArtifactsReady 缺少 TanStack 构建产物时给出明确 cf:build 提示', async () => {
  const tempDir = await fs.mkdtemp(
    path.join(os.tmpdir(), 'cf-local-build-artifacts-')
  );

  try {
    await assert.rejects(
      assertCloudflareLocalBuildArtifactsReady({
        rootPath: tempDir,
        processEnv: {
          SITE: 'mamamiya',
        },
      }),
      /TanStack artifacts[\s\S]*Run `pnpm cf:build` before starting Cloudflare local smoke or spikes/i
    );
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});

test('prepareCloudflareLocalTopologyArtifacts 会生成 router 和全部 server worker 配置，并注入同一组本地值', async () => {
  const tempDir = await fs.mkdtemp(
    path.join(os.tmpdir(), 'cf-local-topology-test-')
  );
  const devVarsPath = path.join(tempDir, '.dev.vars');
  const databaseUrl = 'postgresql://demo:demo@127.0.0.1:5432/demo';
  const routerBaseUrl = 'http://127.0.0.1:9787';

  try {
    const artifacts = await prepareCloudflareLocalTopologyArtifacts({
      databaseUrl,
      routerBaseUrl,
      authSecret: 'topology-secret-0123456789abcdef',
      devVarsPath,
      processEnv: {
        SITE: 'mamamiya',
      },
    });

    try {
      assert.equal(
        artifacts.serverWorkers.length,
        CLOUDFLARE_ALL_SERVER_WORKER_TARGETS.length
      );
      assert.equal(
        artifacts.wranglerConfigPaths.length,
        CLOUDFLARE_ALL_SERVER_WORKER_TARGETS.length + 2
      );
      assert.equal(artifacts.stateWorker.workerName, 'roller-rabbit-state');
      assert.equal(artifacts.persistDir, path.join(artifacts.tempDir, 'state'));
      await assert.doesNotReject(fs.stat(artifacts.persistDir));

      const routerConfig = await fs.readFile(
        artifacts.router.configPath,
        'utf8'
      );
      assert.match(
        routerConfig,
        /localConnectionString = "postgresql:\/\/demo:demo@127\.0\.0\.1:5432\/demo"/
      );
      assert.match(
        routerConfig,
        /NEXT_PUBLIC_APP_URL = "http:\/\/127\.0\.0\.1:9787"/
      );
      assert.match(routerConfig, /\[dev\][\s\S]*host = "127\.0\.0\.1"/);
      assert.match(routerConfig, /\[dev\][\s\S]*upstream_protocol = "http"/);

      const stateConfig = await fs.readFile(
        artifacts.stateWorker.configPath,
        'utf8'
      );
      assert.match(stateConfig, /name = "roller-rabbit-state"/);
      assert.match(
        stateConfig,
        /NEXT_PUBLIC_APP_URL = "http:\/\/127\.0\.0\.1:9787"/
      );
      assert.match(stateConfig, /\[dev\][\s\S]*host = "127\.0\.0\.1"/);

      for (const worker of artifacts.serverWorkers) {
        const config = await fs.readFile(worker.configPath, 'utf8');
        assert.match(
          config,
          /localConnectionString = "postgresql:\/\/demo:demo@127\.0\.0\.1:5432\/demo"/
        );
        assert.match(
          config,
          /NEXT_PUBLIC_APP_URL = "http:\/\/127\.0\.0\.1:9787"/
        );
        assert.match(config, /\[dev\][\s\S]*host = "127\.0\.0\.1"/);
        assert.match(config, /\[dev\][\s\S]*upstream_protocol = "http"/);
      }

      const devVars = await fs.readFile(devVarsPath, 'utf8');
      assert.match(devVars, /AUTH_SECRET=topology-secret-0123456789abcdef/);
      assert.match(
        devVars,
        /BETTER_AUTH_SECRET=topology-secret-0123456789abcdef/
      );
      assert.match(devVars, /NEXT_PUBLIC_APP_URL=http:\/\/127\.0\.0\.1:9787/);
      assert.match(devVars, /AUTH_URL=http:\/\/127\.0\.0\.1:9787/);
      assert.match(devVars, /BETTER_AUTH_URL=http:\/\/127\.0\.0\.1:9787/);
      assert.match(
        devVars,
        /STORAGE_PUBLIC_BASE_URL=http:\/\/127\.0\.0\.1:9787\/assets\//
      );
      assert.match(devVars, /CF_LOCAL_SMOKE_WORKERS_DEV=true/);
    } finally {
      await artifacts.cleanup();
    }

    await assert.rejects(fs.stat(devVarsPath));
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});

test('prepareCloudflareLocalTopologyArtifacts 默认在临时 topology 目录内写入 .dev.vars', async () => {
  const databaseUrl = 'postgresql://demo:demo@127.0.0.1:5432/demo';

  const artifacts = await prepareCloudflareLocalTopologyArtifacts({
    databaseUrl,
    authSecret: 'topology-secret-0123456789abcdef',
    processEnv: {
      SITE: 'mamamiya',
    },
  });

  try {
    const expectedDevVarsPath = path.join(artifacts.tempDir, '.dev.vars');
    assert.equal(artifacts.devVars.devVarsPath, expectedDevVarsPath);

    const devVars = await fs.readFile(expectedDevVarsPath, 'utf8');
    assert.match(devVars, /AUTH_SECRET=topology-secret-0123456789abcdef/);
    assert.match(
      devVars,
      /BETTER_AUTH_SECRET=topology-secret-0123456789abcdef/
    );
  } finally {
    const tempDir = artifacts.tempDir;
    await artifacts.cleanup();
    await assert.rejects(fs.stat(tempDir));
  }
});

test('prepareCloudflareLocalTopologyArtifacts 只生成 active server workers', async () => {
  const artifacts = await prepareCloudflareLocalTopologyArtifacts({
    databaseUrl: 'postgresql://demo:demo@127.0.0.1:5432/demo',
    authSecret: 'topology-secret-0123456789abcdef',
    processEnv: {
      SITE: 'ai-remover',
    },
  });

  try {
    assert.deepEqual(
      artifacts.serverWorkers.map((worker) => worker.target),
      ['public-web', 'auth', 'payment', 'member', 'admin']
    );
    assert.equal(
      artifacts.serverWorkers.some((worker) => worker.target === 'chat'),
      false
    );
  } finally {
    await artifacts.cleanup();
  }
});

test('startCloudflareLocalDevTopology 只创建一个 unified manager，并在 stop 时清理 topology', async () => {
  const events: string[] = [];
  const managerEnvs: Array<Record<string, string | undefined>> = [];
  let cleanupCount = 0;

  const topology = await startCloudflareLocalDevTopology(
    {
      databaseUrl: 'postgresql://demo',
      authSecret: 'topology-secret-0123456789abcdef',
      processEnv: {},
    },
    {
      assertCloudflareLocalBuildArtifactsReadyImpl: async () => {
        events.push('preflight:build-artifacts');
      },
      prepareCloudflareLocalTopologyArtifactsImpl: async () =>
        ({
          router: {
            configPath: '/tmp/router.toml',
            label: 'Cloudflare local topology',
            baseUrl: 'http://127.0.0.1:8787',
            port: 8787,
          },
          stateWorker: {
            label: 'Cloudflare state worker',
            configPath: '/tmp/state.toml',
            workerName: 'state',
          },
          serverWorkers: CLOUDFLARE_ALL_SERVER_WORKER_TARGETS.map((target) => ({
            target,
            label: `Cloudflare server worker ${target}`,
            configPath: `/tmp/${target}.toml`,
            workerName: target,
          })),
          wranglerConfigPaths: [
            '/tmp/router.toml',
            '/tmp/state.toml',
            ...CLOUDFLARE_ALL_SERVER_WORKER_TARGETS.map(
              (target) => `/tmp/${target}.toml`
            ),
          ],
          persistDir: '/tmp/state/local-topology',
          devVars: {
            devVarsPath: '/tmp/.dev.vars',
          },
          async cleanup() {
            cleanupCount += 1;
          },
        }) as never,
      createWranglerMultiConfigDevManagerImpl: ({
        label,
        wranglerConfigPaths,
        persistTo,
        env,
      }) => {
        events.push(`create:${label}`);
        events.push(`configs:${wranglerConfigPaths.join(',')}`);
        events.push(`persist:${persistTo}`);
        managerEnvs.push({
          NEXT_PUBLIC_APP_URL: env?.NEXT_PUBLIC_APP_URL,
          AUTH_URL: env?.AUTH_URL,
          BETTER_AUTH_URL: env?.BETTER_AUTH_URL,
          CF_LOCAL_SMOKE_WORKERS_DEV: env?.CF_LOCAL_SMOKE_WORKERS_DEV,
        });

        return {
          label,
          child: null,
          recentLogs: [],
          readyUrlPromise: Promise.resolve('http://127.0.0.1:8787'),
          async stop() {
            events.push(`stop:${label}`);
          },
        } as never;
      },
    }
  );

  assert.deepEqual(events.slice(0, 4), [
    'preflight:build-artifacts',
    'create:Cloudflare local topology',
    `configs:${[
      '/tmp/router.toml',
      '/tmp/state.toml',
      ...CLOUDFLARE_ALL_SERVER_WORKER_TARGETS.map(
        (target) => `/tmp/${target}.toml`
      ),
    ].join(',')}`,
    'persist:/tmp/state/local-topology',
  ]);
  assert.deepEqual(managerEnvs, [
    {
      NEXT_PUBLIC_APP_URL: 'http://127.0.0.1:8787',
      AUTH_URL: 'http://127.0.0.1:8787',
      BETTER_AUTH_URL: 'http://127.0.0.1:8787',
      CF_LOCAL_SMOKE_WORKERS_DEV: 'true',
    },
  ]);
  assert.equal(topology.getRouterBaseUrl(), 'http://127.0.0.1:8787');

  await topology.stop();

  assert.equal(events.at(-1), 'stop:Cloudflare local topology');
  assert.equal(cleanupCount, 1);
});

test('startCloudflareLocalDevTopology 在 unified manager ready 前失败时返回带 label 的错误', async () => {
  let cleanupCount = 0;

  await assert.rejects(
    startCloudflareLocalDevTopology(
      {
        databaseUrl: 'postgresql://demo',
        authSecret: 'topology-secret-0123456789abcdef',
        processEnv: {},
      },
      {
        assertCloudflareLocalBuildArtifactsReadyImpl: async () => undefined,
        prepareCloudflareLocalTopologyArtifactsImpl: async () =>
          ({
            router: {
              configPath: '/tmp/router.toml',
              label: 'Cloudflare local topology',
              baseUrl: 'http://127.0.0.1:8787',
              port: 8787,
            },
            serverWorkers: [],
            wranglerConfigPaths: ['/tmp/router.toml'],
            persistDir: '/tmp/state/local-topology',
            devVars: {
              devVarsPath: '/tmp/.dev.vars',
            },
            async cleanup() {
              cleanupCount += 1;
            },
          }) as never,
        createWranglerMultiConfigDevManagerImpl: ({ label }) =>
          ({
            label,
            child: null,
            recentLogs: ['boom\n'],
            readyUrlPromise: Promise.reject(new Error('exited before ready')),
            async stop() {},
          }) as never,
      }
    ),
    /Cloudflare local topology failed to start: exited before ready/
  );

  assert.equal(cleanupCount, 1);
});
