import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { resolveRequiredSiteKey } from './lib/site-config.mjs';
import { resolveSiteDeployContract } from './lib/site-deploy-contract.mjs';
import { getActiveSplitWorkerSlots } from './lib/site-deploy-settings.mjs';

const rootDir = process.cwd();
const activeSplitWorkersEnv = 'CLOUDFLARE_ACTIVE_SPLIT_WORKERS';

export function buildOpenNextBuildArgs() {
  return [
    'exec',
    'opennextjs-cloudflare',
    'build',
    '--skipWranglerConfigCheck',
  ];
}

export function buildMultiBuildCheckArgs(scriptArgs = process.argv.slice(2)) {
  return [
    '--import',
    'tsx',
    'scripts/run-cf-multi-build-check.mjs',
    ...scriptArgs,
  ];
}

export function buildStrictI18nCheckArgs(siteKey = resolveRequiredSiteKey()) {
  return ['scripts/check-site-i18n.mjs', '--site', siteKey, '--strict'];
}

function runCommand(command, args, { env = process.env } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: rootDir,
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

async function main() {
  const contract = resolveSiteDeployContract({
    rootDir,
    siteKey: resolveRequiredSiteKey(process.env),
    processEnv: process.env,
  });
  const commandEnv = {
    ...process.env,
    [activeSplitWorkersEnv]: getActiveSplitWorkerSlots(contract).join(','),
  };

  await runCommand('node', buildStrictI18nCheckArgs(contract.site.key), {
    env: commandEnv,
  });
  await runCommand('pnpm', buildOpenNextBuildArgs(), { env: commandEnv });
  await runCommand(
    'node',
    ['--import', 'tsx', 'scripts/bundle-cf-server-functions.mjs'],
    { env: commandEnv }
  );
  await runCommand('node', buildMultiBuildCheckArgs(), { env: commandEnv });
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
