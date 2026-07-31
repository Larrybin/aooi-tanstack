import { spawn } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const REQUIRED_ENV_KEYS = [
  'SITE',
  'RELEASE_TEST_DATABASE_URL',
  'PRODUCTION_DATABASE_URL',
  'CLOUDFLARE_ACCOUNT_ID',
  'CLOUDFLARE_API_TOKEN',
  'STORAGE_PUBLIC_BASE_URL',
  'RESEND_API_KEY',
];
const ACCEPTANCE_WORKFLOW_NAME = 'Cloudflare Deploy Acceptance';

function trimEnv(env, key) {
  return env[key]?.trim() ?? '';
}

function fail(message) {
  throw new Error(`[release:cf] ${message}`);
}

export function validateReleaseEnvironment(env = process.env) {
  const missing = REQUIRED_ENV_KEYS.filter((key) => !trimEnv(env, key));

  if (!trimEnv(env, 'BETTER_AUTH_SECRET') && !trimEnv(env, 'AUTH_SECRET')) {
    missing.push('BETTER_AUTH_SECRET or AUTH_SECRET');
  }

  if (trimEnv(env, 'DATABASE_PROVIDER') !== 'postgresql') {
    missing.push('DATABASE_PROVIDER=postgresql');
  }

  if (missing.length > 0) {
    fail(`missing required environment: ${missing.join(', ')}`);
  }

  const releaseTestDatabaseUrl = trimEnv(env, 'RELEASE_TEST_DATABASE_URL');
  const productionDatabaseUrl = trimEnv(env, 'PRODUCTION_DATABASE_URL');

  if (releaseTestDatabaseUrl === productionDatabaseUrl) {
    fail(
      'RELEASE_TEST_DATABASE_URL must not equal PRODUCTION_DATABASE_URL; tests must not run against production'
    );
  }

  return {
    site: trimEnv(env, 'SITE'),
    releaseTestDatabaseUrl,
    productionDatabaseUrl,
  };
}

export function buildChildEnvironments(env = process.env) {
  const normalized = validateReleaseEnvironment(env);
  const baseEnv = {
    ...env,
    SITE: normalized.site,
    DEPLOY_TARGET: 'cloudflare',
    DATABASE_PROVIDER: 'postgresql',
  };

  return {
    testEnv: {
      ...baseEnv,
      DATABASE_URL: normalized.releaseTestDatabaseUrl,
    },
    productionEnv: {
      ...baseEnv,
      DATABASE_URL: normalized.productionDatabaseUrl,
    },
  };
}

export function execCommand(command, args, options = {}) {
  const { env = process.env, capture = false } = options;

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (chunk) => {
      const value = chunk.toString();
      stdout += value;
      if (!capture) {
        process.stdout.write(value);
      }
    });

    child.stderr?.on('data', (chunk) => {
      const value = chunk.toString();
      stderr += value;
      if (!capture) {
        process.stderr.write(value);
      }
    });

    child.once('error', reject);
    child.once('exit', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }

      reject(
        new Error(
          `${command} ${args.join(' ')} exited with code ${code}\n${stderr || stdout}`
        )
      );
    });
  });
}

async function readCommand(commandRunner, command, args, env) {
  const result = await commandRunner(command, args, {
    env,
    capture: true,
  });
  return result.stdout.trim();
}

export async function assertCleanMainHead({
  commandRunner = execCommand,
  env = process.env,
} = {}) {
  const status = await readCommand(
    commandRunner,
    'git',
    ['status', '--porcelain'],
    env
  );
  if (status) {
    fail('git worktree must be clean before production release');
  }

  const branch = await readCommand(
    commandRunner,
    'git',
    ['branch', '--show-current'],
    env
  );
  if (branch !== 'main') {
    fail(
      `production release must run from main, got ${branch || 'detached HEAD'}`
    );
  }

  await commandRunner('git', ['fetch', 'origin', 'main'], {
    env,
    capture: true,
  });

  const headSha = await readCommand(
    commandRunner,
    'git',
    ['rev-parse', 'HEAD'],
    env
  );
  const originMainSha = await readCommand(
    commandRunner,
    'git',
    ['rev-parse', 'origin/main'],
    env
  );

  if (headSha !== originMainSha) {
    fail(`HEAD ${headSha} must equal origin/main ${originMainSha}`);
  }

  return headSha;
}

export function hasSuccessfulAcceptanceRun(runs, headSha) {
  return runs.some(
    (run) =>
      run?.headSha === headSha &&
      run?.event === 'push' &&
      run?.status === 'completed' &&
      run?.conclusion === 'success'
  );
}

export async function assertSuccessfulAcceptance({
  commandRunner = execCommand,
  env = process.env,
  headSha,
} = {}) {
  const stdout = await readCommand(
    commandRunner,
    'gh',
    [
      'run',
      'list',
      '--workflow',
      ACCEPTANCE_WORKFLOW_NAME,
      '--branch',
      'main',
      '--json',
      'databaseId,status,conclusion,headSha,event',
      '--limit',
      '20',
    ],
    env
  );
  const runs = JSON.parse(stdout || '[]');

  if (!hasSuccessfulAcceptanceRun(runs, headSha)) {
    fail(
      `${ACCEPTANCE_WORKFLOW_NAME} must have a successful completed run for ${headSha}`
    );
  }
}

async function runStep(commandRunner, label, command, args, env) {
  process.stdout.write(`[release:cf] ${label}\n`);
  await commandRunner(command, args, { env, capture: false });
}

export async function runLocalCloudflareRelease({
  commandRunner = execCommand,
  env = process.env,
} = {}) {
  const { testEnv, productionEnv } = buildChildEnvironments(env);
  const headSha = await assertCleanMainHead({ commandRunner, env });
  await assertSuccessfulAcceptance({ commandRunner, env, headSha });

  await runStep(
    commandRunner,
    'checking release inputs',
    'node',
    [
      'scripts/check-release-inputs.mjs',
      '--base-sha=HEAD^1',
      '--head-sha=HEAD',
    ],
    testEnv
  );
  await runStep(commandRunner, 'running lint', 'pnpm', ['lint'], testEnv);
  await runStep(
    commandRunner,
    'running architecture gate',
    'pnpm',
    ['arch:check'],
    testEnv
  );
  await runStep(commandRunner, 'running tests', 'pnpm', ['test'], testEnv);
  await runStep(
    commandRunner,
    'running Cloudflare config gate',
    'pnpm',
    ['cf:check'],
    testEnv
  );
  await runStep(
    commandRunner,
    'running Cloudflare build gate',
    'pnpm',
    ['cf:build'],
    testEnv
  );
  await runStep(
    commandRunner,
    'running production database migrations',
    'pnpm',
    ['db:migrate'],
    productionEnv
  );
  await runStep(
    commandRunner,
    'checking production database migration journal',
    'pnpm',
    ['db:check'],
    productionEnv
  );
  await runStep(
    commandRunner,
    'deploying Cloudflare state worker',
    'node',
    ['--import', 'tsx', 'scripts/run-cf-state-deploy.mjs'],
    productionEnv
  );
  await runStep(
    commandRunner,
    'deploying Cloudflare app workers',
    'node',
    ['--import', 'tsx', 'scripts/run-cf-app-deploy.mjs'],
    productionEnv
  );
  await runStep(
    commandRunner,
    'running production Cloudflare smoke',
    'pnpm',
    ['test:cf-app-smoke'],
    productionEnv
  );
}

async function main() {
  process.env.NODE_ENV = 'production';
  await import('@/config/load-dotenv');
  await runLocalCloudflareRelease();
}

const entryScriptPath = process.argv[1]
  ? pathToFileURL(path.resolve(process.argv[1])).href
  : null;

if (entryScriptPath === import.meta.url) {
  main().catch((error) => {
    console.error(
      error instanceof Error ? error.stack || error.message : String(error)
    );
    process.exit(1);
  });
}
