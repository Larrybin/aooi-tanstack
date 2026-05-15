import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import * as nextEnvModule from '@next/env';

import siteEnvModule from '../src/config/site-env.cjs';

const args = process.argv.slice(2);
const TEST_SITE_KEY = 'dev-local';
const TEST_AUTH_SHARED_SECRET = 'dev-local-auth-secret-dev-local-auth-secret';
const TEST_STORAGE_PUBLIC_BASE_URL = 'http://127.0.0.1:9787/assets/';
const { applySiteLocalEnvOverlay } = siteEnvModule;
const loadEnvConfig =
  nextEnvModule.loadEnvConfig || nextEnvModule.default?.loadEnvConfig;
const SITE_REQUIRED_COMMANDS = [
  'pnpm exec next',
  'node scripts/next-build.mjs',
  'pnpm exec @better-auth/cli generate',
  'node --import tsx scripts/check-cloudflare-config.mjs',
  'pnpm exec opennextjs-cloudflare build',
  'node --import tsx scripts/smoke.mjs',
  'node --import tsx scripts/run-cf-app-deploy.mjs',
  'node --import tsx scripts/run-cf-state-deploy.mjs',
];
const CONTENT_GENERATION_REQUIRED_COMMANDS = [
  'pnpm exec next',
  'node scripts/next-build.mjs',
  'pnpm exec @better-auth/cli generate',
  'node --import tsx scripts/smoke.mjs',
  'node --import tsx scripts/run-cf-app-deploy.mjs',
  'node --import tsx scripts/run-cf-state-deploy.mjs',
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

function requiresContentGeneration(commandParts) {
  const joinedCommand = joinCommand(commandParts);
  return CONTENT_GENERATION_REQUIRED_COMMANDS.some((prefix) =>
    joinedCommand.startsWith(prefix)
  );
}

function loadRootDotenv(env = process.env) {
  try {
    const isDev = env.NODE_ENV !== 'production';
    loadEnvConfig(process.cwd(), isDev);
  } catch {
    // optional for scripts that run before local env files exist
  }
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
  loadRootDotenv(process.env);
  const siteEnv = buildSiteEnv([command, ...commandArgs], process.env, {
    originalEnv,
  });
  const generateExitCode = await runNodeScript(generateScript, [], siteEnv);
  if (generateExitCode !== 0) {
    process.exit(generateExitCode);
  }

  if (requiresContentGeneration([command, ...commandArgs])) {
    const generateContentExitCode = await runNodeScript(
      generateContentScript,
      [],
      siteEnv
    );
    if (generateContentExitCode !== 0) {
      process.exit(generateContentExitCode);
    }
  }

  const child = spawn(command, commandArgs, {
    stdio: 'inherit',
    env: siteEnv,
    shell: true,
  });

  child.on('exit', (code, signal) => {
    if (typeof code === 'number') {
      process.exit(code);
      return;
    }

    if (signal) {
      process.stderr.write(`Command terminated by signal: ${signal}\n`);
    }
    process.exit(1);
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
