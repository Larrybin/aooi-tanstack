import { execFileSync, spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { listSiteKeys } from './cloudflare/contract';

const rootDir = process.cwd();

function run(command: string, args: string[], env = process.env) {
  return new Promise<void>((resolve, reject) => {
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
      resolve();
    });
  });
}

function worktreeState() {
  return execFileSync('git', ['status', '--porcelain=v1'], {
    cwd: rootDir,
    encoding: 'utf8',
  });
}

export async function runCi() {
  for (const script of [
    'format:check',
    'lint',
    'typecheck',
    'test',
    'arch:check',
  ]) {
    await run('pnpm', [script]);
  }

  const before = worktreeState();
  for (const siteKey of listSiteKeys({ rootDir })) {
    await run('pnpm', ['site:gate', '--', '--cloudflare'], {
      ...process.env,
      SITE: siteKey,
    });
  }
  const after = worktreeState();
  if (after !== before) {
    throw new Error(
      'site matrix changed tracked or untracked repository state'
    );
  }
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  runCi().catch((error) => {
    console.error(error instanceof Error ? error.stack : String(error));
    process.exit(1);
  });
}
