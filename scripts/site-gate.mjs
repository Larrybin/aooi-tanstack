import { spawn } from 'node:child_process';
import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { resolveRequiredSiteKey } from './lib/site-config.mjs';
import { resolveSiteDeployContract } from './lib/site-deploy-contract.mjs';
import { buildNoDbCloudflareBuildEnv } from './run-cf-build-no-db.mjs';
import { deriveSiteProductProfile } from './site-contract.mjs';

const TEST_FILE_PATTERN = /\.(test|spec)\.(mjs|[tj]sx?)$/;

function toRepoPath(rootDir, filePath) {
  return path.relative(rootDir, filePath).split(path.sep).join('/');
}

async function isDirectory(pathname) {
  try {
    return (await stat(pathname)).isDirectory();
  } catch {
    return false;
  }
}

async function collectTestFiles(rootDir, directory, out) {
  if (!(await isDirectory(directory))) {
    return;
  }

  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const pathname = path.resolve(directory, entry.name);

    if (entry.isDirectory()) {
      await collectTestFiles(rootDir, pathname, out);
      continue;
    }

    if (entry.isFile() && TEST_FILE_PATTERN.test(entry.name)) {
      out.push(toRepoPath(rootDir, pathname));
    }
  }
}

export async function findFocusedProductTestFiles({
  rootDir = process.cwd(),
  siteKey,
} = {}) {
  const testFiles = [];
  await collectTestFiles(
    rootDir,
    path.resolve(rootDir, 'src', 'domains', siteKey),
    testFiles
  );

  const smokeDir = path.resolve(rootDir, 'tests', 'smoke');
  if (await isDirectory(smokeDir)) {
    const entries = await readdir(smokeDir, { withFileTypes: true });
    for (const entry of entries) {
      if (
        entry.isFile() &&
        entry.name.startsWith(siteKey) &&
        TEST_FILE_PATTERN.test(entry.name)
      ) {
        testFiles.push(toRepoPath(rootDir, path.resolve(smokeDir, entry.name)));
      }
    }
  }

  return [...new Set(testFiles)].sort((left, right) =>
    left.localeCompare(right)
  );
}

export function buildSiteGateSteps({
  siteKey,
  profile,
  focusedTestFiles,
  processEnv = process.env,
}) {
  const siteEnv = { SITE: siteKey };
  const cloudflareCheckEnv =
    profile === 'free-tool-no-db'
      ? buildNoDbCloudflareBuildEnv(siteKey, processEnv)
      : siteEnv;
  const steps = [
    {
      label: 'site contract',
      command: 'pnpm',
      args: ['site:contract'],
      env: siteEnv,
    },
    {
      label: 'production build',
      command: 'pnpm',
      args: ['build'],
      env: siteEnv,
    },
    {
      label: 'Cloudflare config check',
      command: 'pnpm',
      args: ['cf:check'],
      env: cloudflareCheckEnv,
    },
  ];

  if (profile === 'free-tool-no-db') {
    steps.push({
      label: 'no-DB Cloudflare build',
      command: 'pnpm',
      args: ['cf:build:no-db', '--site', siteKey],
      env: siteEnv,
    });
  }

  if (focusedTestFiles.length > 0) {
    steps.push({
      label: 'focused product tests',
      command: 'pnpm',
      args: ['test', '--', ...focusedTestFiles],
      env: siteEnv,
    });
  }

  return steps;
}

function runCommand(command, args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      env,
      stdio: 'inherit',
    });

    child.once('error', reject);
    child.once('exit', (code) => {
      if (code !== 0) {
        reject(
          new Error(
            `${command} ${args.join(' ')} exited with code ${code ?? 1}`
          )
        );
        return;
      }

      resolve(undefined);
    });
  });
}

export async function runSiteGate({
  rootDir = process.cwd(),
  siteKey = resolveRequiredSiteKey(),
  processEnv = process.env,
  runner = runCommand,
  logger = console,
} = {}) {
  const contract = resolveSiteDeployContract({
    rootDir,
    siteKey,
    processEnv,
  });
  const profile = deriveSiteProductProfile(contract);
  const focusedTestFiles = await findFocusedProductTestFiles({
    rootDir,
    siteKey,
  });
  const steps = buildSiteGateSteps({
    siteKey,
    profile,
    focusedTestFiles,
    processEnv,
  });

  logger.log(`[site:gate] site: ${siteKey}`);
  logger.log(`[site:gate] product profile: ${profile}`);
  if (focusedTestFiles.length === 0) {
    logger.log('[site:gate] focused product tests: skipped (none found)');
  } else {
    logger.log(
      `[site:gate] focused product tests: ${focusedTestFiles.join(', ')}`
    );
  }

  for (const step of steps) {
    logger.log(`[site:gate] ${step.label}: start`);
    await runner(step.command, step.args, {
      ...processEnv,
      ...step.env,
    });
    logger.log(`[site:gate] ${step.label}: passed`);
  }
}

async function main() {
  await runSiteGate();
}

const currentFilePath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === currentFilePath) {
  main().catch((error) => {
    console.error(
      error instanceof Error ? error.stack || error.message : String(error)
    );
    process.exit(1);
  });
}
