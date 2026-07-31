import { spawn } from 'node:child_process';
import { rmSync } from 'node:fs';
import { mkdir, open, readFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadRootDotenv } from '../src/config/load-dotenv-core.mjs';
import siteEnvModule from '../src/config/site-env.cjs';
import {
  getActiveSplitWorkerSlots,
  readSiteDeploySettings,
} from './lib/site-deploy-settings.mjs';

const args = process.argv.slice(2);
const TEST_SITE_KEY = 'dev-local';
const TEST_AUTH_SHARED_SECRET = 'dev-local-auth-secret-dev-local-auth-secret';
const TEST_STORAGE_PUBLIC_BASE_URL = 'http://127.0.0.1:9787/assets/';
const ACTIVE_SPLIT_WORKERS_ENV = 'CLOUDFLARE_ACTIVE_SPLIT_WORKERS';
const { applySiteLocalEnvOverlay } = siteEnvModule;
const SITE_REQUIRED_COMMANDS = [
  'pnpm exec vite build',
  'pnpm exec vite preview',
  'pnpm exec @better-auth/cli generate',
  'node --import tsx scripts/check-cloudflare-config.mjs',
  'node --import tsx scripts/site-gate.mjs',
  'node --import tsx scripts/smoke.mjs',
  'node --import tsx scripts/run-cf-app-deploy.mjs',
  'node --import tsx scripts/run-cf-state-deploy.mjs',
];
const CONTENT_GENERATION_REQUIRED_COMMANDS = [
  'pnpm exec tsc',
  'pnpm exec vite',
  'node scripts/run-tests.mjs',
  'pnpm exec @better-auth/cli generate',
  'node --import tsx scripts/run-cf-build.mjs',
  'node --import tsx scripts/smoke.mjs',
  'node --import tsx scripts/run-cf-app-deploy.mjs',
  'node --import tsx scripts/run-cf-state-deploy.mjs',
];
const BUILD_LOCK_REQUIRED_COMMANDS = [
  'pnpm exec vite build',
  'node --import tsx scripts/run-cf-build.mjs',
];

const generateScript = resolve(
  process.cwd(),
  'scripts',
  'generate-site-module.mjs'
);
const generateContentScript = resolve(
  process.cwd(),
  'scripts',
  'generate-content-source-module.mjs'
);

function joinCommand(parts) {
  return parts.join(' ').trim();
}

function requiresExplicitSite(commandParts) {
  const joinedCommand = joinCommand(commandParts);
  return SITE_REQUIRED_COMMANDS.some((prefix) =>
    joinedCommand.startsWith(prefix)
  );
}

export function requiresContentGeneration(commandParts) {
  const joinedCommand = joinCommand(commandParts);
  return CONTENT_GENERATION_REQUIRED_COMMANDS.some((prefix) =>
    joinedCommand.startsWith(prefix)
  );
}

export function requiresBuildLock(commandParts) {
  const joinedCommand = joinCommand(commandParts);
  return BUILD_LOCK_REQUIRED_COMMANDS.some((prefix) =>
    joinedCommand.startsWith(prefix)
  );
}

function isProcessRunning(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function acquireBuildLock({ rootDir = process.cwd() } = {}) {
  const lockDir = resolve(rootDir, '.tmp');
  const lockPath = resolve(lockDir, 'site-build.lockfile');
  const deadline = Date.now() + 30 * 60 * 1000;

  await mkdir(lockDir, { recursive: true });

  while (Date.now() < deadline) {
    try {
      const ownerFile = await open(lockPath, 'wx');
      await ownerFile.writeFile(String(process.pid), 'utf8');
      await ownerFile.close();
      return () => rmSync(lockPath, { force: true });
    } catch (error) {
      if (!(error instanceof Error) || !('code' in error)) throw error;
      if (error.code !== 'EEXIST') throw error;

      let ownerPid = Number.parseInt(
        await readFile(lockPath, 'utf8').catch(() => ''),
        10
      );
      if (!Number.isInteger(ownerPid)) {
        await new Promise((resolveWait) => setTimeout(resolveWait, 100));
        ownerPid = Number.parseInt(
          await readFile(lockPath, 'utf8').catch(() => ''),
          10
        );
      }
      if (!Number.isInteger(ownerPid) || !isProcessRunning(ownerPid)) {
        await rm(lockPath, { force: true });
        continue;
      }

      await new Promise((resolveWait) => setTimeout(resolveWait, 100));
    }
  }

  throw new Error('timed out waiting for the site build lock');
}

function applyActiveSplitWorkerEnv({ env, rootDir, siteKey }) {
  try {
    const deploySettings = readSiteDeploySettings({ rootDir, siteKey });
    env[ACTIVE_SPLIT_WORKERS_ENV] =
      getActiveSplitWorkerSlots(deploySettings).join(',');
  } catch {
    // Site generation and deploy contract checks own the actionable error.
  }

  return env;
}

export function buildSiteEnv(
  commandParts,
  env = process.env,
  { originalEnv = env, rootDir = process.cwd(), readFileSyncImpl } = {}
) {
  const explicitSiteKey = originalEnv.SITE?.trim() || '';
  const siteKey = explicitSiteKey;
  if (siteKey) {
    env.SITE = siteKey;
    applyActiveSplitWorkerEnv({ env, rootDir, siteKey });
    applySiteLocalEnvOverlay({
      env,
      originalEnv,
      rootDir,
      siteKey,
      readFileSyncImpl,
    });

    if (siteKey !== TEST_SITE_KEY) {
      return env;
    }

    const nextEnv = {
      ...env,
      STORAGE_PUBLIC_BASE_URL:
        env.STORAGE_PUBLIC_BASE_URL?.trim() || TEST_STORAGE_PUBLIC_BASE_URL,
    };

    if (!nextEnv.BETTER_AUTH_SECRET?.trim() && !nextEnv.AUTH_SECRET?.trim()) {
      nextEnv.BETTER_AUTH_SECRET = TEST_AUTH_SHARED_SECRET;
      nextEnv.AUTH_SECRET = TEST_AUTH_SHARED_SECRET;
    }

    return nextEnv;
  }

  if (requiresExplicitSite(commandParts)) {
    process.stderr.write(
      `SITE is required for this command. Use an explicit site key such as SITE=mamamiya ${joinCommand(commandParts)}\n`
    );
    process.exit(1);
  }

  const nextEnv = {
    ...env,
    SITE: TEST_SITE_KEY,
  };
  applyActiveSplitWorkerEnv({ env: nextEnv, rootDir, siteKey: TEST_SITE_KEY });

  applySiteLocalEnvOverlay({
    env: nextEnv,
    originalEnv,
    rootDir,
    siteKey: TEST_SITE_KEY,
    readFileSyncImpl,
  });

  nextEnv.STORAGE_PUBLIC_BASE_URL =
    nextEnv.STORAGE_PUBLIC_BASE_URL?.trim() || TEST_STORAGE_PUBLIC_BASE_URL;
  if (!nextEnv.BETTER_AUTH_SECRET?.trim() && !nextEnv.AUTH_SECRET?.trim()) {
    nextEnv.BETTER_AUTH_SECRET = TEST_AUTH_SHARED_SECRET;
    nextEnv.AUTH_SECRET = TEST_AUTH_SHARED_SECRET;
  }

  return nextEnv;
}

function runNodeScript(scriptPath, scriptArgs = [], env = process.env) {
  return new Promise((resolveExitCode) => {
    const child = spawn(process.execPath, [scriptPath, ...scriptArgs], {
      stdio: 'inherit',
      env,
    });

    child.on('exit', (code, signal) => {
      if (typeof code === 'number') {
        resolveExitCode(code);
        return;
      }

      if (signal) {
        process.stderr.write(`Command terminated by signal: ${signal}\n`);
      }
      resolveExitCode(1);
    });
  });
}

async function main() {
  if (args.length === 0) {
    process.stderr.write(
      'Usage: node scripts/run-with-site.mjs <command> [...args]\n'
    );
    process.exit(1);
  }

  const command = args[0];
  const commandArgs = args.slice(1);
  const originalEnv = { ...process.env };
  try {
    loadRootDotenv(process.env);
  } catch {
    // Root dotenv loading is optional for wrapper scripts.
  }
  const siteEnv = buildSiteEnv([command, ...commandArgs], process.env, {
    originalEnv,
  });
  const releaseBuildLock = requiresBuildLock([command, ...commandArgs])
    ? await acquireBuildLock()
    : () => {};
  const releaseAndExit = (code) => {
    releaseBuildLock();
    process.exit(code);
  };
  process.once('SIGINT', () => releaseAndExit(130));
  process.once('SIGTERM', () => releaseAndExit(143));

  const generateExitCode = await runNodeScript(generateScript, [], siteEnv);
  if (generateExitCode !== 0) {
    releaseAndExit(generateExitCode);
  }

  if (requiresContentGeneration([command, ...commandArgs])) {
    const generateContentExitCode = await runNodeScript(
      generateContentScript,
      [],
      siteEnv
    );
    if (generateContentExitCode !== 0) {
      releaseAndExit(generateContentExitCode);
    }
  }

  const child = spawn(command, commandArgs, {
    stdio: 'inherit',
    env: siteEnv,
    shell: true,
  });

  child.on('exit', (code, signal) => {
    if (typeof code === 'number') {
      releaseAndExit(code);
      return;
    }

    if (signal) {
      process.stderr.write(`Command terminated by signal: ${signal}\n`);
    }
    releaseAndExit(1);
  });
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main().catch((error) => {
    process.stderr.write(
      error instanceof Error ? error.stack || error.message : String(error)
    );
    process.stderr.write('\n');
    process.exit(1);
  });
}
