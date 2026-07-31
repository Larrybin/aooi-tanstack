import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildChildEnvironments,
  hasSuccessfulAcceptanceRun,
  runLocalCloudflareRelease,
  validateReleaseEnvironment,
} from '../../scripts/run-local-cloudflare-release.mjs';

type CommandResult = {
  stdout: string;
  stderr: string;
};

type CommandOptions = {
  env?: NodeJS.ProcessEnv;
  capture?: boolean;
};

type CommandCall = {
  command: string;
  args: string[];
  env: NodeJS.ProcessEnv;
  capture: boolean;
};

function createReleaseEnv(
  overrides: Partial<NodeJS.ProcessEnv> = {}
): NodeJS.ProcessEnv {
  return {
    SITE: 'mamamiya',
    RELEASE_TEST_DATABASE_URL:
      'postgresql://postgres:postgres@127.0.0.1:5432/aooi_release_test',
    PRODUCTION_DATABASE_URL:
      'postgresql://postgres:postgres@db.example.com:5432/aooi',
    DATABASE_PROVIDER: 'postgresql',
    CLOUDFLARE_ACCOUNT_ID: 'cf-account',
    CLOUDFLARE_API_TOKEN: 'cf-token',
    STORAGE_PUBLIC_BASE_URL: 'https://assets.example.com/assets/',
    RESEND_API_KEY: 'resend-key',
    BETTER_AUTH_SECRET: 'auth-secret',
    ...overrides,
  };
}

function createCommandRunner(
  overrides: Map<string, CommandResult> = new Map()
) {
  const calls: CommandCall[] = [];
  const headSha = '1111111111111111111111111111111111111111';

  const commandRunner = async (
    command: string,
    args: string[],
    options: CommandOptions = {}
  ): Promise<CommandResult> => {
    const key = `${command} ${args.join(' ')}`;
    const env = options.env ?? {};
    const capture = options.capture ?? false;
    calls.push({ command, args, env, capture });

    if (overrides.has(key)) {
      return overrides.get(key) as CommandResult;
    }

    if (key === 'git status --porcelain') {
      return { stdout: '', stderr: '' };
    }
    if (key === 'git branch --show-current') {
      return { stdout: 'main\n', stderr: '' };
    }
    if (key === 'git fetch origin main') {
      return { stdout: '', stderr: '' };
    }
    if (key === 'git rev-parse HEAD') {
      return { stdout: `${headSha}\n`, stderr: '' };
    }
    if (key === 'git rev-parse origin/main') {
      return { stdout: `${headSha}\n`, stderr: '' };
    }
    if (key.startsWith('gh run list ')) {
      return {
        stdout: JSON.stringify([
          {
            databaseId: 1,
            status: 'completed',
            conclusion: 'success',
            headSha,
            event: 'push',
          },
        ]),
        stderr: '',
      };
    }

    return { stdout: '', stderr: '' };
  };

  return { calls, commandRunner };
}

test('validateReleaseEnvironment rejects missing SITE', () => {
  assert.throws(
    () => validateReleaseEnvironment(createReleaseEnv({ SITE: '' })),
    /missing required environment: SITE/
  );
});

test('validateReleaseEnvironment rejects missing production env as one clear list', () => {
  assert.throws(
    () =>
      validateReleaseEnvironment(
        createReleaseEnv({
          PRODUCTION_DATABASE_URL: '',
          CLOUDFLARE_API_TOKEN: '',
          RESEND_API_KEY: '',
          BETTER_AUTH_SECRET: '',
          AUTH_SECRET: '',
        })
      ),
    /PRODUCTION_DATABASE_URL, CLOUDFLARE_API_TOKEN, RESEND_API_KEY, BETTER_AUTH_SECRET or AUTH_SECRET/
  );
});

test('validateReleaseEnvironment rejects production database as test database', () => {
  assert.throws(
    () =>
      validateReleaseEnvironment(
        createReleaseEnv({
          RELEASE_TEST_DATABASE_URL:
            'postgresql://postgres:postgres@db.example.com:5432/aooi',
        })
      ),
    /tests must not run against production/
  );
});

test('buildChildEnvironments splits test and production database URLs', () => {
  const { testEnv, productionEnv } = buildChildEnvironments(createReleaseEnv());

  assert.equal(
    testEnv.DATABASE_URL,
    'postgresql://postgres:postgres@127.0.0.1:5432/aooi_release_test'
  );
  assert.equal(
    productionEnv.DATABASE_URL,
    'postgresql://postgres:postgres@db.example.com:5432/aooi'
  );
  assert.equal(testEnv.DEPLOY_TARGET, 'cloudflare');
  assert.equal(productionEnv.DATABASE_PROVIDER, 'postgresql');
});

test('runLocalCloudflareRelease rejects dirty worktree before release steps', async () => {
  const overrides = new Map<string, CommandResult>([
    ['git status --porcelain', { stdout: ' M package.json\n', stderr: '' }],
  ]);
  const { calls, commandRunner } = createCommandRunner(overrides);

  await assert.rejects(
    runLocalCloudflareRelease({
      commandRunner,
      env: createReleaseEnv(),
    }),
    /worktree must be clean/
  );

  assert.deepEqual(
    calls.map((call) => `${call.command} ${call.args.join(' ')}`),
    ['git status --porcelain']
  );
});

test('runLocalCloudflareRelease rejects non-main branch', async () => {
  const overrides = new Map<string, CommandResult>([
    [
      'git branch --show-current',
      { stdout: 'feature/local-release\n', stderr: '' },
    ],
  ]);
  const { commandRunner } = createCommandRunner(overrides);

  await assert.rejects(
    runLocalCloudflareRelease({
      commandRunner,
      env: createReleaseEnv(),
    }),
    /must run from main/
  );
});

test('runLocalCloudflareRelease rejects HEAD drift from origin/main', async () => {
  const overrides = new Map<string, CommandResult>([
    [
      'git rev-parse origin/main',
      { stdout: '2222222222222222222222222222222222222222\n', stderr: '' },
    ],
  ]);
  const { commandRunner } = createCommandRunner(overrides);

  await assert.rejects(
    runLocalCloudflareRelease({
      commandRunner,
      env: createReleaseEnv(),
    }),
    /must equal origin\/main/
  );
});

test('runLocalCloudflareRelease rejects missing successful acceptance run', async () => {
  const overrides = new Map<string, CommandResult>([
    [
      'gh run list --workflow Cloudflare Deploy Acceptance --branch main --json databaseId,status,conclusion,headSha,event --limit 20',
      { stdout: '[]', stderr: '' },
    ],
  ]);
  const { commandRunner } = createCommandRunner(overrides);

  await assert.rejects(
    runLocalCloudflareRelease({
      commandRunner,
      env: createReleaseEnv(),
    }),
    /must have a successful completed run/
  );
});

test('hasSuccessfulAcceptanceRun requires a push acceptance run for the exact head', () => {
  const headSha = '1111111111111111111111111111111111111111';

  assert.equal(
    hasSuccessfulAcceptanceRun(
      [
        {
          databaseId: 1,
          status: 'completed',
          conclusion: 'success',
          headSha,
          event: 'pull_request',
        },
      ],
      headSha
    ),
    false
  );

  assert.equal(
    hasSuccessfulAcceptanceRun(
      [
        {
          databaseId: 2,
          status: 'completed',
          conclusion: 'success',
          headSha,
          event: 'push',
        },
      ],
      headSha
    ),
    true
  );
});

test('runLocalCloudflareRelease runs gates then production deploy steps with split env', async () => {
  const { calls, commandRunner } = createCommandRunner();

  await runLocalCloudflareRelease({
    commandRunner,
    env: createReleaseEnv(),
  });

  const stepCalls = calls.filter(
    (call) =>
      !call.capture && (call.command === 'node' || call.command === 'pnpm')
  );
  assert.deepEqual(
    stepCalls.map((call) => `${call.command} ${call.args.join(' ')}`),
    [
      'node scripts/check-release-inputs.mjs --base-sha=HEAD^1 --head-sha=HEAD',
      'pnpm lint',
      'pnpm arch:check',
      'pnpm test',
      'pnpm cf:check',
      'pnpm cf:build',
      'pnpm db:migrate',
      'pnpm db:check',
      'node --import tsx scripts/run-cf-state-deploy.mjs',
      'node --import tsx scripts/run-cf-app-deploy.mjs',
      'pnpm test:cf-app-smoke',
    ]
  );

  const pnpmTestCall = stepCalls.find(
    (call) => call.command === 'pnpm' && call.args[0] === 'test'
  );
  const migrateCall = stepCalls.find(
    (call) => call.command === 'pnpm' && call.args[0] === 'db:migrate'
  );
  const migrationCheckCall = stepCalls.find(
    (call) => call.command === 'pnpm' && call.args[0] === 'db:check'
  );
  const appDeployCall = stepCalls.find((call) =>
    call.args.includes('scripts/run-cf-app-deploy.mjs')
  );

  assert.equal(
    pnpmTestCall?.env.DATABASE_URL,
    'postgresql://postgres:postgres@127.0.0.1:5432/aooi_release_test'
  );
  assert.equal(
    migrateCall?.env.DATABASE_URL,
    'postgresql://postgres:postgres@db.example.com:5432/aooi'
  );
  assert.equal(
    migrationCheckCall?.env.DATABASE_URL,
    'postgresql://postgres:postgres@db.example.com:5432/aooi'
  );
  assert.equal(
    appDeployCall?.env.DATABASE_URL,
    'postgresql://postgres:postgres@db.example.com:5432/aooi'
  );
});
