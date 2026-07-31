import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { resolveSiteCloudflareContract } from './cloudflare/contract';

function run(command: string, args: string[], env: NodeJS.ProcessEnv) {
  return new Promise<void>((resolve, reject) => {
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
      resolve();
    });
  });
}

export async function runSiteGate({
  siteKey = process.env.SITE?.trim(),
  cloudflare = process.argv.includes('--cloudflare'),
  processEnv = process.env,
} = {}) {
  const contract = resolveSiteCloudflareContract({ siteKey });
  const env = {
    ...processEnv,
    SITE: contract.siteKey,
    ...(contract.requires.database
      ? {}
      : { DATABASE_URL: '', AUTH_SPIKE_DATABASE_URL: '' }),
  };

  await run('pnpm', ['site:contract'], env);
  if (cloudflare) {
    await run('pnpm', ['cf:build'], env);
  } else {
    await run('pnpm', ['build'], env);
    await run(
      'pnpm',
      [
        'i18n:check',
        '--',
        '--site',
        contract.siteKey,
        ...(contract.site.i18n?.strictPublishing ? ['--strict'] : []),
      ],
      env
    );
  }
  await run('pnpm', ['client:boundary'], env);
  console.log(`[site:gate] ${contract.siteKey}: passed`);
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  runSiteGate().catch((error) => {
    console.error(error instanceof Error ? error.stack : String(error));
    process.exit(1);
  });
}
