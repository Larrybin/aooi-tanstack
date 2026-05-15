import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import * as envContractNamespace from '../src/config/env-contract.ts';
import {
  collectRequiredRuntimeBindings,
  normalizeCloudflareWorkerKeys,
  readCloudflareDeployRequirements,
  resolveCloudflareWorkerKeys,
} from './lib/cloudflare-runtime-bindings.mjs';
import { resolveCloudflareDeployProfile } from './lib/site-deploy-profile.mjs';

const envContractModule = envContractNamespace.default ?? envContractNamespace;
const { assertAllowedEnvKeys, CLOUDFLARE_SECRET_ENV_KEYS } = envContractModule;

const rootDir = process.cwd();

export const CLOUDFLARE_SECRET_NAMES = [...CLOUDFLARE_SECRET_ENV_KEYS];

/**
 * @typedef {Record<string, string | undefined>} EnvLike
 * @typedef {{
 *   fallbackAuthSecret?: string;
 *   workerKeys?: string[];
 *   runtimeSettings?: unknown;
 *   rootDir?: string;
 * }} CloudflareSecretsOptions
 */

/**
 * @param {EnvLike} [processEnv]
 * @param {{ fallbackAuthSecret?: string }} [options]
 */
export function resolveCloudflareAuthSecretValue(
  processEnv = process.env,
  { fallbackAuthSecret } = {}
) {
  const betterAuthSecret = processEnv.BETTER_AUTH_SECRET?.trim();
  if (betterAuthSecret) {
    return betterAuthSecret;
  }

  const authSecret = processEnv.AUTH_SECRET?.trim();
  if (authSecret) {
    return authSecret;
  }

  if (fallbackAuthSecret?.trim()) {
    return fallbackAuthSecret.trim();
  }

  throw new Error(
    'BETTER_AUTH_SECRET or AUTH_SECRET is required to build Cloudflare secrets'
  );
}

/**
 * @param {EnvLike} processEnv
 * @param {string} name
 * @param {string | undefined} fallbackValue
 */
function resolveRequiredSecretValue(processEnv, name, fallbackValue) {
  const value = processEnv[name]?.trim();
  if (value) {
    return value;
  }

  if (fallbackValue?.trim()) {
    return fallbackValue.trim();
  }

  throw new Error(`${name} is required to build Cloudflare secrets`);
}

function allowsPreviewPlaceholderSecrets(processEnv) {
  return (
    resolveCloudflareDeployProfile(processEnv) === 'preview' &&
    processEnv.CF_PREVIEW_ALLOW_PLACEHOLDER_SECRETS?.trim() === 'true'
  );
}

function buildPreviewPlaceholderSecret(name) {
  return `preview-placeholder-${name.toLowerCase().replaceAll('_', '-')}-not-for-production`;
}

/**
 * @param {EnvLike} processEnv
 * @param {string[]} workerKeys
 */
function buildCloudflareContext(processEnv, workerKeys) {
  return {
    site: processEnv.SITE?.trim() || 'unknown',
    nodeEnv: processEnv.NODE_ENV?.trim() || 'development',
    deployTarget: processEnv.DEPLOY_TARGET?.trim() || 'cloudflare',
    workerScope: workerKeys.join(','),
  };
}

/**
 * @param {Array<{ name?: string; names?: string[] }>} requiredRequirements
 * @param {EnvLike} processEnv
 * @param {{ fallbackAuthSecret?: string }} options
 */
function buildSecretFallbacks(requiredRequirements, processEnv, options) {
  const secretFallbacks = new Map();
  const allowPreviewPlaceholders = allowsPreviewPlaceholderSecrets(processEnv);
  const needsAuthSecret = requiredRequirements.some((requirement) =>
    (requirement.names ?? [requirement.name]).some(
      (name) => name === 'BETTER_AUTH_SECRET' || name === 'AUTH_SECRET'
    )
  );

  if (!needsAuthSecret) {
    return secretFallbacks;
  }

  let authSecret;
  try {
    authSecret = resolveCloudflareAuthSecretValue(processEnv, options);
  } catch (error) {
    if (!allowPreviewPlaceholders) {
      throw error;
    }
    authSecret = buildPreviewPlaceholderSecret('AUTH_SHARED_SECRET');
  }
  secretFallbacks.set('BETTER_AUTH_SECRET', authSecret);
  secretFallbacks.set('AUTH_SECRET', authSecret);
  return secretFallbacks;
}

/**
 * @param {EnvLike} [processEnv]
 * @param {CloudflareSecretsOptions} [options]
 */
export function buildCloudflareSecretsEnv(
  processEnv = process.env,
  options = {}
) {
  const workerKeys = normalizeCloudflareWorkerKeys(options.workerKeys);
  const bindingRequirements =
    options.runtimeSettings ??
    readCloudflareDeployRequirements({
      processEnv,
      rootDir: options.rootDir ?? process.cwd(),
    });
  const requiredRequirements = collectRequiredRuntimeBindings(
    workerKeys,
    bindingRequirements
  );
  const requiredSecretNames = Array.from(
    new Set(
      requiredRequirements
        .filter((requirement) => requirement.kind === 'runtime-secret')
        .flatMap(
          (requirement) =>
            requirement.outputNames ?? requirement.names ?? [requirement.name]
        )
    )
  );
  const secretFallbacks = buildSecretFallbacks(
    requiredRequirements,
    processEnv,
    options
  );
  const allowPreviewPlaceholders = allowsPreviewPlaceholderSecrets(processEnv);
  const resolvedSecrets = Object.fromEntries(
    requiredSecretNames.map((name) => {
      try {
        return [
          name,
          resolveRequiredSecretValue(
            processEnv,
            name,
            secretFallbacks.get(name)
          ),
        ];
      } catch (error) {
        if (allowPreviewPlaceholders) {
          return [name, buildPreviewPlaceholderSecret(name)];
        }
        const context = buildCloudflareContext(processEnv, workerKeys);
        throw new Error(
          `[cf:secrets] missing required secret ${name} for SITE=${context.site} NODE_ENV=${context.nodeEnv} DEPLOY_TARGET=${context.deployTarget} workers=${context.workerScope}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    })
  );

  assertAllowedEnvKeys(
    resolvedSecrets,
    CLOUDFLARE_SECRET_NAMES,
    'Cloudflare secrets env'
  );

  return `${requiredSecretNames.map((name) => `${name}=${resolvedSecrets[name]}`).join('\n')}\n`;
}

export async function writeCloudflareSecretsFile({
  outputPath = path.resolve(rootDir, '.tmp/cloudflare.secrets.env'),
  processEnv = process.env,
  fallbackAuthSecret,
  workerKeys,
  rootDir: runtimeRootDir,
} = {}) {
  const content = buildCloudflareSecretsEnv(processEnv, {
    fallbackAuthSecret,
    workerKeys,
    rootDir: runtimeRootDir,
  });
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, content, 'utf8');

  return {
    outputPath,
    content,
  };
}

async function main() {
  const outArg = process.argv.slice(2).find((arg) => arg.startsWith('--out='));
  const workersArg = process.argv
    .slice(2)
    .find((arg) => arg.startsWith('--workers='));
  const outputPath = outArg
    ? path.resolve(rootDir, outArg.split('=')[1])
    : path.resolve(rootDir, '.tmp/cloudflare.secrets.env');
  if (!workersArg) {
    throw new Error(
      'Cloudflare secrets generation requires --workers=state|app|all|<comma-list>'
    );
  }

  const workerKeys = resolveCloudflareWorkerKeys(workersArg.split('=')[1]);
  const result = await writeCloudflareSecretsFile({ outputPath, workerKeys });
  process.stdout.write(`${result.outputPath}\n`);
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main().catch((error) => {
    process.stderr.write(
      `${error instanceof Error ? error.stack || error.message : String(error)}\n`
    );
    process.exit(1);
  });
}
