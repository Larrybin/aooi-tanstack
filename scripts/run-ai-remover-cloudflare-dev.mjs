import '@/config/load-dotenv';

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { resolveCloudflareAuthSecretValue } from './create-cf-secrets-file.mjs';
import { startCloudflareLocalDevTopology } from './lib/cloudflare-local-topology.mjs';
import {
  injectCloudflareLocalSmokeDevVars,
  resolveLocalSmokeDatabaseUrl,
} from './run-cf-local-smoke.mjs';

const defaultBaseUrl = 'http://localhost:8787';
const defaultAuthSecret = 'local-ai-remover-cloudflare-dev-0123456789';
const defaultModel = '@cf/runwayml/stable-diffusion-v1-5-inpainting';

export function buildAiRemoverCloudflareDevExtraVars({
  model = defaultModel,
} = {}) {
  return {
    REMOVER_AI_PROVIDER: 'cloudflare-workers-ai',
    REMOVER_AI_MODEL: model,
  };
}

export function waitForShutdownSignal() {
  return new Promise((resolve) => {
    const cleanup = () => {
      process.off('SIGINT', onSignal);
      process.off('SIGTERM', onSignal);
    };
    const onSignal = (signal) => {
      cleanup();
      resolve(signal);
    };

    process.once('SIGINT', onSignal);
    process.once('SIGTERM', onSignal);
  });
}

export async function runAiRemoverCloudflareDev({
  baseUrl = process.env.CF_LOCAL_SMOKE_URL?.trim() || defaultBaseUrl,
  databaseUrl = resolveLocalSmokeDatabaseUrl(),
  authSecret,
  model = process.env.REMOVER_AI_MODEL?.trim() || defaultModel,
  logger = console,
  waitUntilStopped = waitForShutdownSignal,
  startCloudflareLocalDevTopologyImpl = startCloudflareLocalDevTopology,
} = {}) {
  if (!databaseUrl) {
    throw new Error(
      'DATABASE_URL or AUTH_SPIKE_DATABASE_URL is required for AI Remover Cloudflare local dev'
    );
  }

  const resolvedAuthSecret =
    authSecret ||
    resolveCloudflareAuthSecretValue(process.env, {
      fallbackAuthSecret: defaultAuthSecret,
    });

  const topology = await startCloudflareLocalDevTopologyImpl({
    databaseUrl,
    routerBaseUrl: baseUrl,
    authSecret: resolvedAuthSecret,
    extraVars: buildAiRemoverCloudflareDevExtraVars({ model }),
  });

  try {
    logger.log(
      `AI Remover Cloudflare local dev ready: ${topology.getRouterBaseUrl()}`
    );
    logger.log(
      `Open ${topology.getRouterBaseUrl()} instead of http://localhost:3000.`
    );
    logger.log('Press Ctrl+C to stop.');
    return await waitUntilStopped({ topology, logger });
  } finally {
    await topology.stop();
  }
}

async function main() {
  injectCloudflareLocalSmokeDevVars();
  await runAiRemoverCloudflareDev();
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main().catch((error) => {
    console.error(
      error instanceof Error ? error.stack || error.message : String(error)
    );
    process.exit(1);
  });
}
