import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { resolveSiteCloudflareContract } from './cloudflare/contract';

type GateRunner = (
  command: string,
  args: string[],
  env: NodeJS.ProcessEnv,
  cwd: string
) => Promise<void>;

type RequiredVarFixture = (siteKey: string) => string;

const REQUIRED_VAR_FIXTURES: Readonly<Record<string, RequiredVarFixture>> = {
  STORAGE_PUBLIC_BASE_URL: (siteKey) =>
    `https://${siteKey}.site-gate.invalid/assets/`,
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: () => 'site-gate-turnstile-site-key',
};

function buildRequiredVarFixtures(
  requiredVars: readonly string[],
  siteKey: string,
  processEnv: NodeJS.ProcessEnv
) {
  const fixtures: NodeJS.ProcessEnv = {};

  for (const name of requiredVars) {
    if (processEnv[name]?.trim()) continue;
    const createFixture = REQUIRED_VAR_FIXTURES[name];
    if (!createFixture) {
      throw new Error(
        `SITE=${siteKey} has no site-gate fixture for required runtime var: ${name}`
      );
    }
    fixtures[name] = createFixture(siteKey);
  }

  return fixtures;
}

function run(
  command: string,
  args: string[],
  env: NodeJS.ProcessEnv,
  cwd: string
) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
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
  rootDir = process.cwd(),
  runCommand = run as GateRunner,
} = {}) {
  const contract = resolveSiteCloudflareContract({ rootDir, siteKey });
  const env = {
    ...processEnv,
    SITE: contract.siteKey,
    ...buildRequiredVarFixtures(
      contract.requiredVars,
      contract.siteKey,
      processEnv
    ),
    ...(contract.requires.database
      ? {}
      : { DATABASE_URL: '', AUTH_SPIKE_DATABASE_URL: '' }),
  };

  await runCommand('pnpm', ['site:contract'], env, rootDir);
  if (cloudflare) {
    await runCommand('pnpm', ['cf:build'], env, rootDir);
  } else {
    await runCommand('pnpm', ['build'], env, rootDir);
    await runCommand(
      'pnpm',
      [
        'i18n:check',
        '--',
        '--site',
        contract.siteKey,
        ...(contract.site.i18n?.strictPublishing ? ['--strict'] : []),
      ],
      env,
      rootDir
    );
  }
  await runCommand('pnpm', ['client:boundary'], env, rootDir);
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
