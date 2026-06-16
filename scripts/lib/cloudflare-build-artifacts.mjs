import { stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..'
);

export const NATIVE_TANSTACK_SERVER_ARTIFACT = 'dist/server/server.mjs';
export const NATIVE_TANSTACK_ASSETS_DIR = 'dist/client';

const APP_RUNTIME_ARTIFACTS = [
  NATIVE_TANSTACK_SERVER_ARTIFACT,
  NATIVE_TANSTACK_ASSETS_DIR,
];

const STATE_RUNTIME_ARTIFACTS = [
  'cloudflare/workers/state.ts',
  'cloudflare/workers/stateful-limiters.ts',
];

export function getRequiredCloudflareBuildArtifactPaths() {
  return [...APP_RUNTIME_ARTIFACTS];
}

export function getRequiredCloudflareStateBuildArtifactPaths() {
  return [...STATE_RUNTIME_ARTIFACTS];
}

export async function assertCloudflareBuildArtifactsReady({
  rootPath = rootDir,
  artifactPaths = getRequiredCloudflareBuildArtifactPaths(),
  contextMessage = 'Cloudflare deployment requires built TanStack artifacts.',
  nextStepMessage = 'Run the Cloudflare build before deploying.',
} = {}) {
  const missingPaths = [];

  for (const relativePath of artifactPaths) {
    try {
      await stat(path.resolve(rootPath, relativePath));
    } catch {
      missingPaths.push(relativePath);
    }
  }

  if (missingPaths.length === 0) return;

  throw new Error(
    [contextMessage, nextStepMessage, `Missing artifacts: ${missingPaths.join(', ')}`].join(' ')
  );
}
