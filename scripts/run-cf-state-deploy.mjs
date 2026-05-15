import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { writeCloudflareSecretsFile } from './create-cf-secrets-file.mjs';
import { buildCloudflareWranglerConfig } from './create-cf-wrangler-config.mjs';
import {
  assertCloudflareBuildArtifactsReady,
  getRequiredCloudflareStateBuildArtifactPaths,
} from './lib/cloudflare-build-artifacts.mjs';
import { CLOUDFLARE_STATE_WORKER_SCOPE } from './lib/cloudflare-runtime-bindings.mjs';
import { resolveRequiredSiteKey } from './lib/site-config.mjs';
import { resolveSiteDeployContract } from './lib/site-deploy-contract.mjs';

const rootDir = process.cwd();

function log(message) {
  console.log(`[cf:deploy:state] ${message}`);
}

export function createDeployMessage(label = 'state-deploy') {
  return `${label}-${new Date().toISOString().replaceAll(':', '-')}`;
}

export function buildStateDeployWranglerArgs({
  name,
  configPath,
  secretsPath,
  message = createDeployMessage(),
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

function runWrangler(args) {
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
      if (code !== 0) {
        reject(
          new Error(
            `wrangler ${args.join(' ')} exited with code ${code}\n${stderr || stdout}`
          )
        );
        return;
      }

      resolve({ stdout, stderr });
    });
  });
}

async function createStateDeployArtifacts() {
  const contract = resolveSiteDeployContract({
    rootDir,
    siteKey: resolveRequiredSiteKey(process.env),
  });
  const stateConfigPath = path.resolve(
    rootDir,
    contract.stateWorker.wranglerConfigRelativePath
  );
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'cf-state-deploy-'));
  const tempConfigPath = path.join(tempDir, 'wrangler.state.toml');
  const secretsPath = path.join(tempDir, 'state.secrets.env');
  const template = await readFile(stateConfigPath, 'utf8');
  const content = buildCloudflareWranglerConfig({
    template,
    contract,
    workerSlot: 'state',
    templatePath: stateConfigPath,
    outputPath: tempConfigPath,
    validateTemplateContract: true,
  });

  await writeFile(tempConfigPath, content, 'utf8');
  const { content: secretsContent } = await writeCloudflareSecretsFile({
    outputPath: secretsPath,
    workerKeys: CLOUDFLARE_STATE_WORKER_SCOPE,
  });

  return {
    workerName: contract.stateWorker.workerName,
    configPath: tempConfigPath,
    secretsFilePath: secretsPath,
    secretsPath: secretsContent.trim() ? secretsPath : null,
    async cleanup() {
      await rm(tempDir, { recursive: true, force: true });
    },
  };
}

export async function deployCloudflareState({
  createArtifacts = createStateDeployArtifacts,
  runWranglerCommand = runWrangler,
  assertBuildArtifactsReadyImpl = () =>
    assertCloudflareBuildArtifactsReady({
      rootPath: rootDir,
      processEnv: process.env,
      artifactPaths: getRequiredCloudflareStateBuildArtifactPaths(),
      contextMessage:
        'Cloudflare state deploy requires built Durable Object artifacts.',
      nextStepMessage:
        'Run `pnpm cf:build` if the state Durable Object artifacts are missing.',
    }),
} = {}) {
  await assertBuildArtifactsReadyImpl();
  const artifacts = await createArtifacts();

  try {
    log(`deploying ${artifacts.workerName} via wrangler deploy`);
    await runWranglerCommand(
      buildStateDeployWranglerArgs({
        name: artifacts.workerName,
        configPath: artifacts.configPath,
        secretsPath: artifacts.secretsPath,
      })
    );
  } finally {
    await artifacts.cleanup();
  }
}

const entryScriptPath = process.argv[1]
  ? pathToFileURL(path.resolve(process.argv[1])).href
  : null;

if (entryScriptPath === import.meta.url) {
  deployCloudflareState().catch((error) => {
    console.error(
      error instanceof Error ? error.stack || error.message : String(error)
    );
    process.exit(1);
  });
}
