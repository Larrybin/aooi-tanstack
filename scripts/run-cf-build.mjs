import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = process.cwd();

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

function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: rootDir,
      env: process.env,
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
  await runCommand('pnpm', buildOpenNextBuildArgs());
  await runCommand('node', [
    '--import',
    'tsx',
    'scripts/bundle-cf-server-functions.mjs',
  ]);
  await runCommand('node', buildMultiBuildCheckArgs());
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
