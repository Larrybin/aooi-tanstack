import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildCloudflareWranglerConfig } from '../create-cf-wrangler-config.mjs';
import { assertCloudflareBuildArtifactsReady } from './cloudflare-build-artifacts.mjs';
import {
  createWranglerMultiConfigDevManager,
  ensureCiDevVars,
  normalizePreviewBaseUrl,
  resolveAuthSecret,
} from './cloudflare-dev-runtime.mjs';
import { resolveRequiredSiteKey } from './site-config.mjs';
import { resolveSiteDeployContract } from './site-deploy-contract.mjs';

const rootDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..'
);

const DEFAULT_ROUTER_BASE_URL = 'http://localhost:8787';
const DEFAULT_ROUTER_PORT = 8787;
const TOPOLOGY_MANAGER_LABEL = 'Cloudflare local topology';
/**
 * @typedef {Record<string, string | undefined>} EnvLike
 */

function buildLocalTopologyRuntimeVars(routerBaseUrl) {
  return {
    NEXT_PUBLIC_APP_URL: routerBaseUrl,
    AUTH_URL: routerBaseUrl,
    BETTER_AUTH_URL: routerBaseUrl,
    STORAGE_PUBLIC_BASE_URL: `${routerBaseUrl}/assets/`,
    CF_LOCAL_SMOKE_WORKERS_DEV: 'true',
  };
}

function resolveLocalTopologyExtraVars(extraVars, processEnv) {
  const resolvedExtraVars = { ...extraVars };
  const localAuthDebug = processEnv.CF_LOCAL_AUTH_DEBUG?.trim();

  if (localAuthDebug) {
    resolvedExtraVars.CF_LOCAL_AUTH_DEBUG = localAuthDebug;
  }

  return resolvedExtraVars;
}

function readWranglerLocalConnectionString(content) {
  const match = content.match(
    /\[\[hyperdrive\]\][\s\S]*?^\s*localConnectionString\s*=\s*"([^"\n]+)"/m
  );
  return match?.[1]?.trim() || '';
}

async function canListenOnPort(port) {
  return await new Promise((resolve) => {
    const server = net.createServer();

    server.once('error', () => {
      resolve(false);
    });

    server.listen(port, '127.0.0.1', () => {
      server.close(() => resolve(true));
    });
  });
}

export async function findAvailablePort(startPort, reservedPorts = new Set()) {
  for (let port = startPort; port < startPort + 200; port += 1) {
    if (reservedPorts.has(port)) {
      continue;
    }

    if (await canListenOnPort(port)) {
      return port;
    }
  }

  throw new Error(`No available port found from ${startPort}`);
}

export async function resolveCloudflareLocalTopologyPorts({
  routerBaseUrl = DEFAULT_ROUTER_BASE_URL,
} = {}) {
  const requestedUrl = new URL(normalizePreviewBaseUrl(routerBaseUrl));
  const requestedRouterPort =
    Number.parseInt(requestedUrl.port || String(DEFAULT_ROUTER_PORT), 10) ||
    DEFAULT_ROUTER_PORT;
  const routerPort = await findAvailablePort(requestedRouterPort);

  requestedUrl.port = String(routerPort);

  return {
    routerPort,
    routerBaseUrl: normalizePreviewBaseUrl(requestedUrl.toString()),
  };
}

/**
 * @param {{rootPath?: string, processEnv?: EnvLike}} [options]
 */
export async function assertCloudflareLocalBuildArtifactsReady({
  rootPath = rootDir,
  processEnv = process.env,
} = {}) {
  await assertCloudflareBuildArtifactsReady({
    rootPath,
    processEnv,
    contextMessage:
      'Cloudflare local topology requires built OpenNext artifacts.',
    nextStepMessage:
      'Run `pnpm cf:build` before starting Cloudflare local smoke or spikes.',
  });
}

/**
 * @param {{
 *   databaseUrl?: string,
 *   routerTemplatePath?: string | null,
 *   routerBaseUrl?: string,
 *   authSecret?: string,
 *   extraVars?: EnvLike,
 *   processEnv?: EnvLike,
 *   devVarsPath?: string | null,
 * }} [options]
 */
export async function prepareCloudflareLocalTopologyArtifacts({
  databaseUrl,
  routerTemplatePath = null,
  routerBaseUrl = DEFAULT_ROUTER_BASE_URL,
  authSecret = resolveAuthSecret(),
  extraVars = {},
  processEnv = process.env,
  devVarsPath = null,
} = {}) {
  if (!databaseUrl) {
    throw new Error(
      'DATABASE_URL or AUTH_SPIKE_DATABASE_URL is required for Cloudflare local topology'
    );
  }

  const runtimeVars = buildLocalTopologyRuntimeVars(routerBaseUrl);
  const runtimeExtraVars = resolveLocalTopologyExtraVars(extraVars, processEnv);
  const storagePublicBaseUrl =
    runtimeExtraVars.STORAGE_PUBLIC_BASE_URL ||
    runtimeVars.STORAGE_PUBLIC_BASE_URL;
  const contract = resolveSiteDeployContract({
    rootDir,
    siteKey: resolveRequiredSiteKey(processEnv),
  });
  const tmpRoot = path.resolve(rootDir, '.tmp');
  await mkdir(tmpRoot, { recursive: true });

  const tempDir = await mkdtemp(path.join(tmpRoot, 'cf-local-topology-'));
  const resolvedDevVarsPath = devVarsPath || path.join(tempDir, '.dev.vars');
  const persistDir = path.join(tempDir, 'state');
  const ports = await resolveCloudflareLocalTopologyPorts({ routerBaseUrl });
  const routerDevOrigin = new URL(ports.routerBaseUrl);
  const resolvedRouterTemplatePath =
    routerTemplatePath ||
    path.resolve(rootDir, contract.router.wranglerConfigRelativePath);
  const routerTemplate = await readFile(resolvedRouterTemplatePath, 'utf8');
  const routerConfigPath = path.join(tempDir, 'wrangler.cloudflare.local.toml');
  const routerConfig = buildCloudflareWranglerConfig({
    template: routerTemplate,
    contract,
    workerSlot: 'router',
    databaseUrl,
    appUrl: ports.routerBaseUrl,
    storagePublicBaseUrl,
    deployTarget: 'cloudflare',
    devHost: routerDevOrigin.hostname,
    devUpstreamProtocol: routerDevOrigin.protocol.replace(/:$/, ''),
    templatePath: resolvedRouterTemplatePath,
    outputPath: routerConfigPath,
    validateTemplateContract: true,
  });
  await writeFile(routerConfigPath, routerConfig, 'utf8');
  await mkdir(persistDir, { recursive: true });

  const stateTemplatePath = path.resolve(
    rootDir,
    contract.stateWorker.wranglerConfigRelativePath
  );
  const stateTemplate = await readFile(stateTemplatePath, 'utf8');
  const stateConfigPath = path.join(tempDir, 'wrangler.state.local.toml');
  const stateConfig = buildCloudflareWranglerConfig({
    template: stateTemplate,
    contract,
    workerSlot: 'state',
    appUrl: ports.routerBaseUrl,
    storagePublicBaseUrl,
    deployTarget: 'cloudflare',
    devHost: routerDevOrigin.hostname,
    devUpstreamProtocol: routerDevOrigin.protocol.replace(/:$/, ''),
    templatePath: stateTemplatePath,
    outputPath: stateConfigPath,
    validateTemplateContract: true,
  });
  await writeFile(stateConfigPath, stateConfig, 'utf8');

  const serverWorkers = [];
  for (const [target, metadata] of Object.entries(contract.serverWorkers)) {
    const templatePath = path.resolve(
      rootDir,
      metadata.wranglerConfigRelativePath
    );
    const template = await readFile(templatePath, 'utf8');
    const configPath = path.join(tempDir, `wrangler.${target}.local.toml`);
    const config = buildCloudflareWranglerConfig({
      template,
      contract,
      workerSlot: target,
      databaseUrl,
      appUrl: ports.routerBaseUrl,
      storagePublicBaseUrl,
      deployTarget: 'cloudflare',
      devHost: routerDevOrigin.hostname,
      devUpstreamProtocol: routerDevOrigin.protocol.replace(/:$/, ''),
      templatePath,
      outputPath: configPath,
      validateTemplateContract: true,
    });
    await writeFile(configPath, config, 'utf8');

    serverWorkers.push({
      target,
      label: `Cloudflare server worker ${target}`,
      configPath,
      workerName: metadata.workerName,
    });
  }

  const devVars = await ensureCiDevVars({
    authSecret,
    devVarsPath: resolvedDevVarsPath,
    extraVars: {
      DEPLOY_TARGET: 'cloudflare',
      CF_LOCAL_WRANGLER_CONFIG_PATH: routerConfigPath,
      ...runtimeVars,
      ...runtimeExtraVars,
    },
  });

  return {
    tempDir,
    persistDir,
    router: {
      label: TOPOLOGY_MANAGER_LABEL,
      configPath: routerConfigPath,
      port: ports.routerPort,
      baseUrl: ports.routerBaseUrl,
    },
    stateWorker: {
      label: 'Cloudflare state worker',
      configPath: stateConfigPath,
      workerName: contract.stateWorker.workerName,
    },
    serverWorkers,
    wranglerConfigPaths: [
      routerConfigPath,
      stateConfigPath,
      ...serverWorkers.map((worker) => worker.configPath),
    ],
    devVars,
    async cleanup() {
      await devVars.cleanup();
      await rm(tempDir, { recursive: true, force: true });
    },
  };
}

function formatRecentLogs(label, recentLogs) {
  if (!recentLogs?.length) {
    return `--- recent ${label} logs ---\n(no logs)\n--- end ${label} logs ---`;
  }

  return [
    `--- recent ${label} logs ---`,
    recentLogs.join(''),
    `--- end ${label} logs ---`,
  ].join('\n');
}

function buildManagerStartError(label, manager, error) {
  const detail = error instanceof Error ? error.message : String(error);
  return new Error(
    `${label} failed to start: ${detail}\n${formatRecentLogs(label, manager?.recentLogs)}`
  );
}

export function renderCloudflareLocalTopologyLogs(topology) {
  if (!topology?.manager) {
    return '';
  }

  return formatRecentLogs(topology.manager.label, topology.manager.recentLogs);
}

export async function startCloudflareLocalDevTopology(
  /**
   * @type {{
   *   databaseUrl?: string,
   *   routerTemplatePath?: string | null,
   *   routerBaseUrl?: string,
   *   authSecret?: string,
   *   extraVars?: EnvLike,
   *   processEnv?: EnvLike,
   *   logger?: Console,
   *   devVarsPath?: string | null,
   * }}
   */
  {
    databaseUrl,
    routerTemplatePath = null,
    routerBaseUrl = DEFAULT_ROUTER_BASE_URL,
    authSecret,
    extraVars = {},
    processEnv = process.env,
    logger = console,
    devVarsPath = null,
  } = {},
  {
    assertCloudflareLocalBuildArtifactsReadyImpl = assertCloudflareLocalBuildArtifactsReady,
    prepareCloudflareLocalTopologyArtifactsImpl = prepareCloudflareLocalTopologyArtifacts,
    createWranglerMultiConfigDevManagerImpl = createWranglerMultiConfigDevManager,
  } = {}
) {
  await assertCloudflareLocalBuildArtifactsReadyImpl();

  const resolvedAuthSecret = authSecret || resolveAuthSecret(processEnv);
  const artifacts = await prepareCloudflareLocalTopologyArtifactsImpl({
    databaseUrl,
    routerTemplatePath,
    routerBaseUrl,
    authSecret: resolvedAuthSecret,
    extraVars,
    processEnv,
    devVarsPath,
  });
  const childEnv = {
    ...processEnv,
    ...buildLocalTopologyRuntimeVars(artifacts.router.baseUrl),
    AUTH_SECRET: resolvedAuthSecret,
    BETTER_AUTH_SECRET: resolvedAuthSecret,
    DEPLOY_TARGET: 'cloudflare',
    ...resolveLocalTopologyExtraVars(extraVars, processEnv),
  };

  let manager = null;

  try {
    manager = createWranglerMultiConfigDevManagerImpl({
      label: TOPOLOGY_MANAGER_LABEL,
      wranglerConfigPaths: artifacts.wranglerConfigPaths,
      port: artifacts.router.port,
      persistTo: artifacts.persistDir,
      env: childEnv,
      logger,
    });

    const routerBaseUrlResolved = normalizePreviewBaseUrl(
      await manager.readyUrlPromise
    );

    return {
      manager,
      router: {
        ...artifacts.router,
        baseUrl: routerBaseUrlResolved,
      },
      getRouterBaseUrl() {
        return routerBaseUrlResolved;
      },
      getRecentLogs() {
        return renderCloudflareLocalTopologyLogs(this);
      },
      async stop() {
        await manager?.stop?.();
        await artifacts.cleanup();
      },
    };
  } catch (error) {
    try {
      await manager?.stop?.();
    } catch {
      // ignore cleanup failures while unwinding startup
    }
    await artifacts.cleanup();
    throw buildManagerStartError(TOPOLOGY_MANAGER_LABEL, manager, error);
  }
}

export async function resolveCloudflareLocalDatabaseUrl({
  processEnv = process.env,
  wranglerConfigPath = processEnv.CF_LOCAL_WRANGLER_CONFIG_PATH?.trim() || '',
} = {}) {
  const explicitDatabaseUrl =
    processEnv.AUTH_SPIKE_DATABASE_URL?.trim() ||
    processEnv.DATABASE_URL?.trim();
  if (explicitDatabaseUrl) {
    return explicitDatabaseUrl;
  }

  try {
    const wranglerContent = await readFile(wranglerConfigPath, 'utf8');
    return readWranglerLocalConnectionString(wranglerContent);
  } catch {
    return '';
  }
}
