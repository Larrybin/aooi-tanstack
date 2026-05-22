import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import topology from '../src/shared/config/cloudflare-worker-topology.ts';
import { createCanonicalTypegenWranglerConfig } from './check-cf-typegen.mjs';
import { writeCloudflareSecretsFile } from './create-cf-secrets-file.mjs';
import { buildCloudflareWranglerConfig } from './create-cf-wrangler-config.mjs';
import { assertCloudflareBuildArtifactsReady } from './lib/cloudflare-build-artifacts.mjs';
import { resolveRequiredSiteKey } from './lib/site-config.mjs';
import { resolveSiteDeployContract } from './lib/site-deploy-contract.mjs';

const { CLOUDFLARE_VERSION_ID_VARS } = topology;

const rootDir = process.cwd();

function log(message) {
  console.log(`[cf:deploy:app] ${message}`);
}

function createDeployMessage(label) {
  return `${label}-${new Date().toISOString().replaceAll(':', '-')}`;
}

function resolveDeployContract({
  rootPath = rootDir,
  siteKey = resolveRequiredSiteKey(process.env),
} = {}) {
  return resolveSiteDeployContract({
    rootDir: rootPath,
    siteKey,
  });
}

function resolveRouterConfigPath(contract, rootPath = rootDir) {
  return path.resolve(rootPath, contract.router.wranglerConfigRelativePath);
}

function resolveServerConfigPaths(contract, rootPath = rootDir) {
  return Object.fromEntries(
    getUploadOrder(contract).map((target) => [
      target,
      path.resolve(
        rootPath,
        contract.serverWorkers[target].wranglerConfigRelativePath
      ),
    ])
  );
}

function getUploadOrder(contract) {
  return Object.keys(contract.serverWorkers);
}

function runWrangler(args, { allowFailure = false } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn('pnpm', ['exec', 'wrangler', ...args], {
      cwd: rootDir,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      const value = chunk.toString();
      stdout += value;
      process.stdout.write(value);
    });

    child.stderr.on('data', (chunk) => {
      const value = chunk.toString();
      stderr += value;
      process.stderr.write(value);
    });

    child.once('error', reject);
    child.once('exit', (code) => {
      if (code !== 0 && !allowFailure) {
        reject(
          new Error(
            `wrangler ${args.join(' ')} exited with code ${code}\n${stderr || stdout}`
          )
        );
        return;
      }

      resolve({ code: code ?? 1, stdout, stderr });
    });
  });
}

function parseUploadedVersionId(output) {
  const explicitMatch = output.match(
    /(?:Worker Version ID|version id)[^0-9a-f]*([0-9a-f-]{36})/i
  );
  if (explicitMatch?.[1]) {
    return explicitMatch[1];
  }

  const fallbackMatch = output.match(/[0-9a-f]{8}-[0-9a-f-]{27}/i);
  if (fallbackMatch?.[0]) {
    return fallbackMatch[0];
  }

  throw new Error(`Could not parse worker version id from output:\n${output}`);
}

function collectVersionCandidates(value, out = []) {
  if (!value) {
    return out;
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      collectVersionCandidates(entry, out);
    }
    return out;
  }

  if (typeof value !== 'object') {
    return out;
  }

  const record = value;
  const candidateId =
    pickString(record, ['version_id', 'versionId', 'id']) ?? null;
  const percentage = pickNumber(record, [
    'percentage',
    'traffic_percentage',
    'trafficPercentage',
  ]);

  if (candidateId && /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(candidateId)) {
    out.push({
      id: candidateId,
      percentage,
    });
  }

  for (const nestedValue of Object.values(record)) {
    collectVersionCandidates(nestedValue, out);
  }

  return out;
}

function pickString(record, keys) {
  for (const key of keys) {
    if (typeof record[key] === 'string' && record[key].trim()) {
      return record[key].trim();
    }
  }

  return null;
}

function pickNumber(record, keys) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
  }

  return null;
}

export function parseWranglerJsonPayload(output) {
  const trimmed = output.trim();
  if (!trimmed) {
    return null;
  }

  const firstArrayIndex = trimmed.indexOf('[');
  const lastArrayIndex = trimmed.lastIndexOf(']');
  if (firstArrayIndex >= 0 && lastArrayIndex > firstArrayIndex) {
    return JSON.parse(trimmed.slice(firstArrayIndex, lastArrayIndex + 1));
  }

  const firstObjectIndex = trimmed.indexOf('{');
  const lastObjectIndex = trimmed.lastIndexOf('}');
  if (firstObjectIndex >= 0 && lastObjectIndex > firstObjectIndex) {
    return JSON.parse(trimmed.slice(firstObjectIndex, lastObjectIndex + 1));
  }

  return null;
}

async function readCurrentVersionId(name, configPath) {
  const result = await runWrangler(
    ['deployments', 'status', '--json', '--config', configPath, '--name', name],
    { allowFailure: true }
  );

  if (result.code !== 0 || !result.stdout.trim()) {
    return null;
  }

  try {
    const payload =
      parseWranglerJsonPayload(result.stdout) ?? JSON.parse(result.stdout);
    const candidates = collectVersionCandidates(payload)
      .filter((candidate, index, all) => {
        return all.findIndex((entry) => entry.id === candidate.id) === index;
      })
      .sort(
        (left, right) => (right.percentage ?? -1) - (left.percentage ?? -1)
      );

    return candidates[0]?.id ?? null;
  } catch {
    return null;
  }
}

function buildVersionSpec(versionId, percentage) {
  return `${versionId}@${percentage}%`;
}

export function buildVersionDeploySpecs(currentVersionId, nextVersionId) {
  return currentVersionId
    ? [
        buildVersionSpec(nextVersionId, 100),
        buildVersionSpec(currentVersionId, 0),
      ]
    : [buildVersionSpec(nextVersionId, 100)];
}

function normalizeServerVersionIds(versionIds, label, targets) {
  return Object.fromEntries(
    targets.map((target) => {
      const versionId = versionIds[target];
      if (!versionId) {
        throw new Error(`Missing ${label} version id for ${target}`);
      }

      return [target, versionId];
    })
  );
}

export function buildRouterAppVersionIds(
  currentVersions,
  nextVersions,
  contract = null
) {
  const targets = contract
    ? getUploadOrder(contract)
    : Object.keys(nextVersions).length > 0
      ? Object.keys(nextVersions)
      : Object.keys(currentVersions.servers);
  return {
    compatibility: normalizeServerVersionIds(
      currentVersions.servers,
      'current server',
      targets
    ),
    target: normalizeServerVersionIds(nextVersions, 'next server', targets),
  };
}

export async function buildRouterDeployConfigContent({
  contract = resolveDeployContract(),
  versionIds = {},
  rootPath = rootDir,
}) {
  const routerConfigPath = resolveRouterConfigPath(contract, rootPath);
  const outputPath = path.resolve(
    rootPath,
    '.tmp/wrangler.cloudflare.router.deploy.toml'
  );
  const template = await readFile(routerConfigPath, 'utf8');

  return buildCloudflareWranglerConfig({
    template,
    contract,
    workerSlot: 'router',
    storagePublicBaseUrl: process.env.STORAGE_PUBLIC_BASE_URL?.trim(),
    templatePath: routerConfigPath,
    outputPath,
    versionVars: Object.fromEntries(
      getUploadOrder(contract).map((target) => [
        CLOUDFLARE_VERSION_ID_VARS[target],
        versionIds[target],
      ])
    ),
    validateTemplateContract: true,
  });
}

export function buildRouterDirectDeployArgs({
  configPath,
  name,
  secretsPath,
  message = createDeployMessage('app-router-deploy'),
}) {
  const args = [
    'deploy',
    '--config',
    configPath,
    '--name',
    name,
    '--message',
    message,
    '--experimental-autoconfig=false',
    '--keep-vars',
  ];

  if (secretsPath) {
    args.push('--secrets-file', secretsPath);
  }

  return args;
}

export function determineDeployMode(currentVersions, contract = null) {
  if (!currentVersions.router) {
    return 'missing-deployments';
  }

  const targets = contract
    ? getUploadOrder(contract)
    : Object.keys(currentVersions.servers);
  return targets.some((target) => !currentVersions.servers[target])
    ? 'missing-deployments'
    : 'steady-state';
}

function isBootstrapMissingEnabled(processEnv = process.env) {
  return processEnv.CF_DEPLOY_BOOTSTRAP_MISSING?.trim() === 'true';
}

export async function createTempDeployArtifacts({
  name,
  templatePath,
  workerKeys,
  versionIds = {},
  contract = resolveDeployContract(),
}) {
  const workerSlot = workerKeys.length === 1 ? workerKeys[0] : null;
  if (!workerSlot) {
    throw new Error(
      'createTempDeployArtifacts requires exactly one worker slot'
    );
  }

  const tempDir = await mkdtemp(path.join(os.tmpdir(), `cf-${name}-`));
  const tempConfigPath = path.join(tempDir, `${name}.wrangler.toml`);
  const secretsPath = path.join(tempDir, `${name}.secrets.env`);
  const template = await readFile(templatePath, 'utf8');
  const content = buildCloudflareWranglerConfig({
    template,
    contract,
    workerSlot,
    storagePublicBaseUrl: process.env.STORAGE_PUBLIC_BASE_URL?.trim(),
    templatePath,
    outputPath: tempConfigPath,
    versionVars: versionIds
      ? Object.fromEntries(
          Object.entries(versionIds).map(([target, versionId]) => [
            CLOUDFLARE_VERSION_ID_VARS[target],
            versionId,
          ])
        )
      : {},
    validateTemplateContract: true,
  });

  await writeFile(tempConfigPath, content, 'utf8');
  const { content: secretsContent } = await writeCloudflareSecretsFile({
    outputPath: secretsPath,
    workerKeys,
  });

  return {
    tempDir,
    tempConfigPath,
    secretsFilePath: secretsPath,
    secretsPath: secretsContent.trim() ? secretsPath : null,
    async cleanup() {
      await rm(tempDir, { recursive: true, force: true });
    },
  };
}

async function deployRouterDirect({ name, configPath, secretsPath }) {
  log(`deploying ${name} via wrangler deploy`);
  await runWrangler(
    buildRouterDirectDeployArgs({
      configPath,
      name,
      secretsPath,
    })
  );
}

async function uploadWorkerVersion({ name, configPath, secretsPath }) {
  log(`uploading version for ${name}`);
  const args = [
    'versions',
    'upload',
    '--config',
    configPath,
    '--name',
    name,
    '--message',
    createDeployMessage('app-version-upload'),
  ];
  if (secretsPath) {
    args.push('--secrets-file', secretsPath);
  }
  const result = await runWrangler(args);
  const versionId = parseUploadedVersionId(
    `${result.stdout}\n${result.stderr}`
  );
  log(`uploaded ${name} version ${versionId}`);
  return versionId;
}

async function deployWorkerVersionSet({
  name,
  configPath,
  currentVersionId,
  nextVersionId,
}) {
  const specs = buildVersionDeploySpecs(currentVersionId, nextVersionId);

  log(`deploying ${name}: ${specs.join(', ')}`);
  await runWrangler([
    'versions',
    'deploy',
    ...specs,
    '--config',
    configPath,
    '--name',
    name,
    '--message',
    createDeployMessage('app-rollout'),
    '--yes',
  ]);
}

async function collectCurrentVersions(contract = resolveDeployContract()) {
  const routerConfigPath = resolveRouterConfigPath(contract);
  const serverConfigPaths = resolveServerConfigPaths(contract);
  const versions = {};

  for (const target of getUploadOrder(contract)) {
    versions[target] = await readCurrentVersionId(
      contract.serverWorkers[target].workerName,
      serverConfigPaths[target]
    );
  }

  return {
    router: await readCurrentVersionId(
      contract.router.workerName,
      routerConfigPath
    ),
    servers: versions,
  };
}

function buildMissingDeploymentsError(currentVersions, contract) {
  const missingWorkers = [];

  if (!currentVersions.router) {
    missingWorkers.push(contract.router.workerName);
  }

  for (const target of getUploadOrder(contract)) {
    if (!currentVersions.servers[target]) {
      missingWorkers.push(contract.serverWorkers[target].workerName);
    }
  }

  const setupMessage =
    contract.deployProfile === 'preview'
      ? 'Run "pnpm cf:preview:deploy:state" first, then run "pnpm cf:preview:bootstrap".'
      : 'Run "pnpm cf:deploy:state" first, then run "pnpm cf:deploy:app" or "pnpm cf:deploy".';

  return new Error(
    `Cloudflare app deploy requires an existing state-initialized topology. Missing deployed workers: ${missingWorkers.join(
      ', '
    )}. ${setupMessage}`
  );
}

async function refreshCloudflareTypes() {
  const artifacts = await createCanonicalTypegenWranglerConfig();

  try {
    await runWrangler(
      [
        'types',
        '--config',
        artifacts.configPath,
        '--env-interface',
        'CloudflareEnv',
        path.resolve(rootDir, 'src/shared/types/cloudflare.d.ts'),
      ],
      {
        allowFailure: true,
      }
    );
  } finally {
    await artifacts.cleanup();
  }
}

async function deploySteadyState(
  currentVersions,
  contract = resolveDeployContract()
) {
  const routerConfigPath = resolveRouterConfigPath(contract);
  const serverConfigPaths = resolveServerConfigPaths(contract);
  const serverArtifacts = [];
  let targetRouterArtifacts = null;

  try {
    const nextVersions = {};

    for (const target of getUploadOrder(contract)) {
      const name = contract.serverWorkers[target].workerName;
      const artifacts = await createTempDeployArtifacts({
        name,
        templatePath: serverConfigPaths[target],
        workerKeys: [target],
        contract,
      });
      serverArtifacts.push({ target, ...artifacts });
    }

    for (const { target, tempConfigPath, secretsPath } of serverArtifacts) {
      const name = contract.serverWorkers[target].workerName;
      nextVersions[target] = await uploadWorkerVersion({
        name,
        configPath: tempConfigPath,
        secretsPath,
      });
    }

    for (const { target, tempConfigPath } of serverArtifacts) {
      await deployWorkerVersionSet({
        name: contract.serverWorkers[target].workerName,
        configPath: tempConfigPath,
        currentVersionId: currentVersions.servers[target],
        nextVersionId: nextVersions[target],
      });
    }

    const targetRouterVersionIds = buildRouterAppVersionIds(
      currentVersions,
      nextVersions,
      contract
    ).target;

    targetRouterArtifacts = await createTempDeployArtifacts({
      name: contract.router.workerName,
      templatePath: routerConfigPath,
      workerKeys: ['router'],
      versionIds: targetRouterVersionIds,
      contract,
    });
    await deployRouterDirect({
      name: contract.router.workerName,
      configPath: targetRouterArtifacts.tempConfigPath,
      secretsPath: targetRouterArtifacts.secretsPath,
    });

    await refreshCloudflareTypes();
  } finally {
    for (const artifacts of serverArtifacts) {
      await artifacts.cleanup();
    }

    if (targetRouterArtifacts) {
      await targetRouterArtifacts.cleanup();
    }
  }
}

async function deployInitialAppTopology(contract = resolveDeployContract()) {
  const routerConfigPath = resolveRouterConfigPath(contract);
  const serverConfigPaths = resolveServerConfigPaths(contract);
  const serverArtifacts = [];
  let targetRouterArtifacts = null;

  try {
    for (const target of getUploadOrder(contract)) {
      const name = contract.serverWorkers[target].workerName;
      const artifacts = await createTempDeployArtifacts({
        name,
        templatePath: serverConfigPaths[target],
        workerKeys: [target],
        contract,
      });
      serverArtifacts.push({ target, ...artifacts });
    }

    for (const { target, tempConfigPath, secretsPath } of serverArtifacts) {
      await deployRouterDirect({
        name: contract.serverWorkers[target].workerName,
        configPath: tempConfigPath,
        secretsPath,
      });
    }

    const currentVersions = await collectCurrentVersions(contract);
    const targetRouterVersionIds = {};
    for (const target of getUploadOrder(contract)) {
      const versionId = currentVersions.servers[target];
      if (!versionId) {
        throw new Error(
          `Cloudflare preview bootstrap could not read version id for ${contract.serverWorkers[target].workerName}`
        );
      }
      targetRouterVersionIds[target] = versionId;
    }

    targetRouterArtifacts = await createTempDeployArtifacts({
      name: contract.router.workerName,
      templatePath: routerConfigPath,
      workerKeys: ['router'],
      versionIds: targetRouterVersionIds,
      contract,
    });
    await deployRouterDirect({
      name: contract.router.workerName,
      configPath: targetRouterArtifacts.tempConfigPath,
      secretsPath: targetRouterArtifacts.secretsPath,
    });

    await refreshCloudflareTypes();
  } finally {
    for (const artifacts of serverArtifacts) {
      await artifacts.cleanup();
    }

    if (targetRouterArtifacts) {
      await targetRouterArtifacts.cleanup();
    }
  }
}

export async function deployCloudflareApp({
  contract = resolveDeployContract(),
  collectCurrentVersionsImpl = (resolvedContract) =>
    collectCurrentVersions(resolvedContract),
  deploySteadyStateImpl = (currentVersions, resolvedContract) =>
    deploySteadyState(currentVersions, resolvedContract),
  deployInitialAppTopologyImpl = (resolvedContract) =>
    deployInitialAppTopology(resolvedContract),
  assertBuildArtifactsReadyImpl = () =>
    assertCloudflareBuildArtifactsReady({
      rootPath: rootDir,
      processEnv: process.env,
      contextMessage:
        'Cloudflare app deploy requires built OpenNext artifacts.',
      nextStepMessage:
        'Run `pnpm cf:build` before `pnpm cf:preview:deploy`, `pnpm cf:preview:bootstrap`, `pnpm cf:deploy`, or `pnpm cf:deploy:app`.',
    }),
  processEnv = process.env,
} = {}) {
  await assertBuildArtifactsReadyImpl();
  const bootstrapMissing = isBootstrapMissingEnabled(processEnv);
  if (bootstrapMissing && contract.deployProfile !== 'preview') {
    throw new Error(
      'CF_DEPLOY_BOOTSTRAP_MISSING=true is only allowed with CF_DEPLOY_PROFILE=preview'
    );
  }

  const currentVersions = await collectCurrentVersionsImpl(contract);
  const deployMode = determineDeployMode(currentVersions, contract);

  if (deployMode === 'missing-deployments') {
    if (bootstrapMissing) {
      log('missing preview app workers detected; bootstrapping app topology');
      await deployInitialAppTopologyImpl(contract);
      return;
    }

    throw buildMissingDeploymentsError(currentVersions, contract);
  }

  log(
    'detected existing app worker deployments; entering steady-state rollout'
  );
  await deploySteadyStateImpl(currentVersions, contract);
}

export { buildCloudflareWranglerConfig };

const entryScriptPath = process.argv[1]
  ? pathToFileURL(path.resolve(process.argv[1])).href
  : null;

if (entryScriptPath === import.meta.url) {
  deployCloudflareApp().catch((error) => {
    console.error(
      error instanceof Error ? error.stack || error.message : String(error)
    );
    process.exit(1);
  });
}
