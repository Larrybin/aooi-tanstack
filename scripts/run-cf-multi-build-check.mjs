import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { writeCloudflareSecretsFile } from './create-cf-secrets-file.mjs';
import { buildCloudflareWranglerConfig } from './create-cf-wrangler-config.mjs';
import {
  assertCloudflareBuildArtifactsReady,
  NATIVE_TANSTACK_SERVER_ARTIFACT,
} from './lib/cloudflare-build-artifacts.mjs';
import { resolveCloudflareWorkerKeys } from './lib/cloudflare-runtime-bindings.mjs';
import { resolveRequiredSiteKey } from './lib/site-config.mjs';
import { resolveSiteDeployContract } from './lib/site-deploy-contract.mjs';

const rootDir = process.cwd();
const fallbackBuildSecret = 'cf-build-dry-run-secret-0123456789abcdef';

function resolveDeployContract({
  rootPath = rootDir,
  siteKey = resolveRequiredSiteKey(process.env),
} = {}) {
  return resolveSiteDeployContract({
    rootDir: rootPath,
    siteKey,
  });
}

export function resolveBuildWorkerKeys(args = process.argv.slice(2)) {
  const contract = resolveDeployContract();
  const workersArg = args.find((arg) => arg.startsWith('--workers='));
  const workerKeys = workersArg
    ? resolveCloudflareWorkerKeys(workersArg.split('=')[1], { contract })
    : resolveCloudflareWorkerKeys('app', { contract });
  return workerKeys.filter((workerKey) => workerKey !== 'state');
}

function buildUploadTargets(contract, rootPath = rootDir, workerKeys) {
  const selectedWorkers = new Set(workerKeys);
  return [
    {
      label: 'router',
      name: contract.router.workerName,
      configPath: path.resolve(
        rootPath,
        contract.router.wranglerConfigRelativePath
      ),
      workerSlot: 'router',
    },
    ...Object.entries(contract.serverWorkers).map(([target, worker]) => ({
      label: target,
      name: worker.workerName,
      configPath: path.resolve(rootPath, worker.wranglerConfigRelativePath),
      workerSlot: target,
      bundleEntryRelativePath: worker.bundleEntryRelativePath,
    })),
  ].filter((target) => selectedWorkers.has(target.label));
}

function fail(message) {
  console.error(`[cf:build] ${message}`);
  process.exit(1);
}

function formatSizeKiB(kib) {
  return {
    kib: kib.toFixed(2),
    mib: (kib / 1024).toFixed(2),
  };
}

function formatSizeBytes(bytes) {
  return {
    bytes,
    kib: (bytes / 1024).toFixed(2),
    mib: (bytes / 1024 / 1024).toFixed(2),
  };
}

export function parseDryRunUploadSize(output) {
  const match = output.match(
    /Total Upload:\s*([0-9.]+)\s*KiB\s*\/\s*gzip:\s*([0-9.]+)\s*KiB/i
  );
  if (!match?.[1] || !match?.[2]) {
    throw new Error(
      `Could not parse dry-run upload size from output:\n${output}`
    );
  }

  return {
    totalKiB: Number.parseFloat(match[1]),
    gzipKiB: Number.parseFloat(match[2]),
  };
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

async function assertNativeBuildArtifactsExist() {
  try {
    await assertCloudflareBuildArtifactsReady({
      rootPath: rootDir,
      contextMessage:
        'Cloudflare build dry-run requires built TanStack artifacts.',
      nextStepMessage: 'Run `SITE=<site-key> pnpm cf:build` first.',
    });
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
  }
}

export function buildVersionUploadDryRunArgs({
  configPath,
  secretsPath,
  name,
}) {
  const args = [
    'versions',
    'upload',
    '--dry-run',
    '--config',
    configPath,
    '--name',
    name,
  ];
  if (secretsPath) {
    args.push('--secrets-file', secretsPath);
  }
  return args;
}

async function readServerBundleDiagnostics(target) {
  const handlerPath = path.resolve(
    rootDir,
    target.bundleEntryRelativePath || NATIVE_TANSTACK_SERVER_ARTIFACT
  );
  const metaPath = `${handlerPath}.meta.json`;
  const handlerStats = await fs.promises.stat(handlerPath);
  const handlerSize = formatSizeBytes(handlerStats.size);

  let topInputsSummary = 'meta unavailable';
  if (fs.existsSync(metaPath)) {
    const meta = JSON.parse(await readFile(metaPath, 'utf8'));
    const topInputs = Object.entries(meta.inputs || {})
      .map(([inputPath, inputMeta]) => ({
        inputPath,
        bytes:
          inputMeta && typeof inputMeta === 'object' && 'bytes' in inputMeta
            ? Number(inputMeta.bytes) || 0
            : 0,
      }))
      .sort((left, right) => right.bytes - left.bytes)
      .slice(0, 5)
      .map(
        ({ inputPath, bytes }) =>
          `${path.basename(inputPath)}=${(bytes / 1024).toFixed(1)}KiB`
      );

    if (topInputs.length > 0) {
      topInputsSummary = topInputs.join(', ');
    }
  }

  return {
    handlerPath,
    handlerSize,
    topInputsSummary,
  };
}

async function main() {
  const contract = resolveDeployContract();
  const workerKeys = resolveBuildWorkerKeys();
  if (workerKeys.length === 0) {
    fail(
      'cf:build worker scope must include router or at least one app worker'
    );
  }
  const uploadTargets = buildUploadTargets(contract, rootDir, workerKeys);
  await assertNativeBuildArtifactsExist();
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'cf-build-dry-run-'));
  const emptyAssetsDir = path.join(tempDir, 'assets');
  const secretsPath = path.join(tempDir, 'cloudflare.secrets.env');

  try {
    await mkdir(emptyAssetsDir, { recursive: true });
    const { content: secretsContent } = await writeCloudflareSecretsFile({
      outputPath: secretsPath,
      fallbackAuthSecret: fallbackBuildSecret,
      workerKeys,
    });
    const activeSecretsPath = secretsContent.trim() ? secretsPath : null;

    for (const target of uploadTargets) {
      const tempConfigPath = path.join(
        tempDir,
        `${target.label}.wrangler.toml`
      );
      const template = await readFile(target.configPath, 'utf8');
      const generatedConfig = buildCloudflareWranglerConfig({
        template,
        contract,
        workerSlot: target.workerSlot,
        storagePublicBaseUrl: process.env.STORAGE_PUBLIC_BASE_URL?.trim(),
        templatePath: target.configPath,
        outputPath: tempConfigPath,
        validateTemplateContract: true,
      }).replace(
        /(^\s*directory\s*=\s*")([^"\n]*)(")/m,
        `$1${emptyAssetsDir}$3`
      );
      await writeFile(tempConfigPath, generatedConfig, 'utf8');
      const result = await runWrangler(
        buildVersionUploadDryRunArgs({
          configPath: tempConfigPath,
          name: target.name,
          secretsPath: activeSecretsPath,
        })
      );
      const sizes = parseDryRunUploadSize(`${result.stdout}\n${result.stderr}`);
      const formatted = formatSizeKiB(sizes.gzipKiB);
      const diagnostics =
        target.label === 'router'
          ? null
          : await readServerBundleDiagnostics(target);

      console.log(
        `[cf:build] ${target.label}: gzip ${formatted.kib} KiB / ${formatted.mib} MiB (total ${sizes.totalKiB.toFixed(2)} KiB)`
      );
      if (diagnostics) {
        console.log(
          `[cf:build] ${target.label}: raw server artifact ${diagnostics.handlerSize.kib} KiB / ${diagnostics.handlerSize.mib} MiB (${path.relative(rootDir, diagnostics.handlerPath)})`
        );
        console.log(
          `[cf:build] ${target.label}: top inputs ${diagnostics.topInputsSummary}`
        );
      }

      if (sizes.gzipKiB >= 3 * 1024) {
        fail(
          `${target.label} deployable bundle is ${formatted.mib} MiB gzip; limit is 3.00 MiB`
        );
      }
    }
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
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
