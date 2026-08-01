import { spawn } from 'node:child_process';
import type { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadRootDotenv } from '../src/config/load-dotenv-core';
import { applySiteLocalEnvOverlay } from '../src/config/site-env';
import { generateParaglide } from './generate-paraglide';
import { resolveSiteBuildPaths } from './lib/build-paths';

const args = process.argv.slice(2);
const TEST_SITE_KEY = 'dev-local';
const TEST_AUTH_SHARED_SECRET = 'dev-local-auth-secret-dev-local-auth-secret';
const TEST_STORAGE_PUBLIC_BASE_URL = 'http://127.0.0.1:9787/assets/';
const SITE_REQUIRED_COMMANDS = [
  'pnpm exec vite build',
  'pnpm exec vite preview',
  'pnpm exec @better-auth/cli generate',
  'pnpm exec tsx scripts/cloudflare.ts',
  'node --import tsx scripts/smoke.mjs',
];
const CONTENT_GENERATION_REQUIRED_COMMANDS = [
  'pnpm exec tsc',
  'pnpm exec vite',
  'pnpm exec tsx scripts/run-tests.ts',
  'pnpm exec @better-auth/cli generate',
  'node --import tsx scripts/smoke.mjs',
];
const ROUTE_GENERATION_REQUIRED_COMMANDS = [
  'pnpm exec tsc',
  'pnpm exec vite build',
  'pnpm exec vite dev',
];

const generateScript = resolve(
  process.cwd(),
  'scripts/generate-site-module.ts'
);
const generateContentScript = resolve(
  process.cwd(),
  'scripts/generate-content-source-module.mts'
);
const generateRouteTreeScript = resolve(
  process.cwd(),
  'scripts/generate-route-tree.ts'
);

type BuildSiteEnvOptions = {
  originalEnv?: NodeJS.ProcessEnv;
  rootDir?: string;
  readFileSyncImpl?: typeof readFileSync;
};

function joinCommand(parts: string[]) {
  return parts.join(' ').trim();
}

function requiresExplicitSite(commandParts: string[]) {
  const joinedCommand = joinCommand(commandParts);
  return SITE_REQUIRED_COMMANDS.some((prefix) =>
    joinedCommand.startsWith(prefix)
  );
}

export function requiresContentGeneration(commandParts: string[]) {
  const joinedCommand = joinCommand(commandParts);
  return CONTENT_GENERATION_REQUIRED_COMMANDS.some((prefix) =>
    joinedCommand.startsWith(prefix)
  );
}

export function requiresRouteGeneration(commandParts: string[]) {
  const joinedCommand = joinCommand(commandParts);
  return ROUTE_GENERATION_REQUIRED_COMMANDS.some((prefix) =>
    joinedCommand.startsWith(prefix)
  );
}

function applySiteBuildPaths(
  env: NodeJS.ProcessEnv,
  rootDir: string,
  siteKey: string
) {
  const inheritedBuildSite = env.AOOI_BUILD_SITE?.trim();
  if (inheritedBuildSite && inheritedBuildSite !== siteKey) {
    delete env.AOOI_GENERATED_DIR;
    delete env.AOOI_DIST_DIR;
    delete env.AOOI_SITE_TSCONFIG;
    delete env.TSX_TSCONFIG_PATH;
  }

  const paths = resolveSiteBuildPaths({ rootDir, siteKey, env });
  env.AOOI_BUILD_SITE = siteKey;
  env.AOOI_GENERATED_DIR = paths.generatedDir;
  env.AOOI_DIST_DIR = paths.distDir;
  env.AOOI_SITE_TSCONFIG = paths.tsconfigPath;
  env.TSX_TSCONFIG_PATH = paths.tsconfigPath;
  return env;
}

export function buildSiteEnv(
  commandParts: string[],
  env: NodeJS.ProcessEnv = process.env,
  {
    originalEnv = env,
    rootDir = process.cwd(),
    readFileSyncImpl,
  }: BuildSiteEnvOptions = {}
) {
  const explicitSiteKey = originalEnv.SITE?.trim() || '';
  const siteKey = explicitSiteKey || TEST_SITE_KEY;

  if (!explicitSiteKey && requiresExplicitSite(commandParts)) {
    process.stderr.write(
      `SITE is required for this command. Use an explicit site key such as SITE=mamamiya ${joinCommand(commandParts)}\n`
    );
    process.exit(1);
  }

  const nextEnv = explicitSiteKey ? env : { ...env, SITE: siteKey };
  nextEnv.SITE = siteKey;
  applySiteLocalEnvOverlay({
    env: nextEnv,
    originalEnv,
    rootDir,
    siteKey,
    readFileSyncImpl,
  });

  if (siteKey === TEST_SITE_KEY) {
    nextEnv.STORAGE_PUBLIC_BASE_URL =
      nextEnv.STORAGE_PUBLIC_BASE_URL?.trim() || TEST_STORAGE_PUBLIC_BASE_URL;
    if (!nextEnv.BETTER_AUTH_SECRET?.trim() && !nextEnv.AUTH_SECRET?.trim()) {
      nextEnv.BETTER_AUTH_SECRET = TEST_AUTH_SHARED_SECRET;
      nextEnv.AUTH_SECRET = TEST_AUTH_SHARED_SECRET;
    }
  }

  return applySiteBuildPaths(nextEnv, rootDir, siteKey);
}

function runTypeScript(
  scriptPath: string,
  scriptArgs: string[] = [],
  env: NodeJS.ProcessEnv = process.env,
  { useSiteTsconfig = true } = {}
) {
  return new Promise<number>((resolveExitCode) => {
    const childEnv = { ...env };
    if (!useSiteTsconfig) delete childEnv.TSX_TSCONFIG_PATH;
    const child = spawn(
      process.execPath,
      ['--import', 'tsx', scriptPath, ...scriptArgs],
      { stdio: 'inherit', env: childEnv }
    );

    child.on('exit', (code, signal) => {
      if (typeof code === 'number') return resolveExitCode(code);
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
      'Usage: tsx scripts/run-with-site.ts <command> [...args]\n'
    );
    process.exit(1);
  }

  const command = args[0]!;
  const commandArgs = args.slice(1);
  const originalEnv = { ...process.env };
  try {
    loadRootDotenv(process.env);
  } catch {
    // Root dotenv loading is optional for wrapper scripts.
  }
  const commandParts = [command, ...commandArgs];
  const siteEnv = buildSiteEnv(commandParts, process.env, { originalEnv });

  const generateExitCode = await runTypeScript(generateScript, [], siteEnv, {
    useSiteTsconfig: false,
  });
  if (generateExitCode !== 0) process.exit(generateExitCode);

  if (requiresContentGeneration(commandParts)) {
    await generateParaglide({
      rootDir: process.cwd(),
      siteKey: siteEnv.SITE!,
      env: siteEnv,
    });

    const contentExitCode = await runTypeScript(
      generateContentScript,
      [],
      siteEnv
    );
    if (contentExitCode !== 0) process.exit(contentExitCode);
  }

  if (requiresRouteGeneration(commandParts)) {
    const routeExitCode = await runTypeScript(
      generateRouteTreeScript,
      [],
      siteEnv
    );
    if (routeExitCode !== 0) process.exit(routeExitCode);
  }

  if (
    command === 'pnpm' &&
    commandArgs[0] === 'exec' &&
    commandArgs[1] === 'tsc'
  ) {
    commandArgs.push('--project', siteEnv.AOOI_SITE_TSCONFIG!);
  }

  const child = spawn(command, commandArgs, {
    stdio: 'inherit',
    env: siteEnv,
    shell: true,
  });
  child.on('exit', (code, signal) => {
    if (typeof code === 'number') process.exit(code);
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
