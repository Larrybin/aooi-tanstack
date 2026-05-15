import { stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { resolveRequiredSiteKey } from './site-config.mjs';
import { resolveSiteDeployContract } from './site-deploy-contract.mjs';

const rootDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..'
);

const ROUTER_RUNTIME_ARTIFACTS = [
  '.open-next/worker.js',
  '.open-next/cloudflare/images.js',
  '.open-next/cloudflare/init.js',
  '.open-next/middleware/handler.mjs',
  '.open-next/.build/durable-objects/queue.js',
  '.open-next/.build/durable-objects/sharded-tag-cache.js',
];

const STATE_RUNTIME_ARTIFACTS = [
  '.open-next/.build/durable-objects/queue.js',
  '.open-next/.build/durable-objects/sharded-tag-cache.js',
];

function resolveServerWorkerHandlerPath(target, processEnv = process.env) {
  const contract = resolveSiteDeployContract({
    rootDir,
    siteKey: resolveRequiredSiteKey(processEnv),
  });
  const metadata = contract.serverWorkers[target];
  return path.join(
    path.dirname(metadata.bundleEntryRelativePath),
    'handler.mjs'
  );
}

export function getRequiredCloudflareBuildArtifactPaths(
  processEnv = process.env
) {
  const contract = resolveSiteDeployContract({
    rootDir,
    siteKey: resolveRequiredSiteKey(processEnv),
  });

  return [
    ...ROUTER_RUNTIME_ARTIFACTS,
    ...Object.keys(contract.serverWorkers).map((target) =>
      resolveServerWorkerHandlerPath(target, processEnv)
    ),
  ];
}

export function getRequiredCloudflareStateBuildArtifactPaths() {
  return [...STATE_RUNTIME_ARTIFACTS];
}

export async function assertCloudflareBuildArtifactsReady({
  rootPath = rootDir,
  processEnv = process.env,
  artifactPaths = getRequiredCloudflareBuildArtifactPaths(processEnv),
  contextMessage = 'Cloudflare deployment requires built OpenNext artifacts.',
  nextStepMessage = 'Run `pnpm cf:build` before deploying.',
} = {}) {
  const missingPaths = [];

  for (const relativePath of artifactPaths) {
    try {
      await stat(path.resolve(rootPath, relativePath));
    } catch {
      missingPaths.push(relativePath);
    }
  }

  if (missingPaths.length === 0) {
    return;
  }

  throw new Error(
    [
      contextMessage,
      nextStepMessage,
      `Missing artifacts: ${missingPaths.join(', ')}`,
    ].join(' ')
  );
}
