import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const rootDir = process.cwd();
const require = createRequire(import.meta.url);
const tsxLoader = require.resolve('tsx');
const storagePublicBaseUrlName = ['STORAGE', 'PUBLIC', 'BASE', 'URL'].join('_');
const forbiddenIdentityEnvName = ['NEXT_PUBLIC', 'APP', 'NAME'].join('_');
const appUrlEnvName = ['NEXT_PUBLIC', 'APP', 'URL'].join('_');
const requiredSecretEnvNames = [
  'BETTER_AUTH_SECRET',
  'AUTH_SECRET',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'GITHUB_CLIENT_ID',
  'GITHUB_CLIENT_SECRET',
  'RESEND_API_KEY',
  'STRIPE_PUBLISHABLE_KEY',
  'STRIPE_SECRET_KEY',
  'STRIPE_SIGNING_SECRET',
  'CREEM_API_KEY',
  'CREEM_SIGNING_SECRET',
  'PAYPAL_CLIENT_ID',
  'PAYPAL_CLIENT_SECRET',
  'PAYPAL_WEBHOOK_ID',
  'OPENROUTER_API_KEY',
  'REPLICATE_API_TOKEN',
  'FAL_API_KEY',
  'KIE_API_KEY',
  'REMOVER_CLEANUP_SECRET',
] as const;

async function copyCloudflareConfigFixture(tempDir: string) {
  await mkdir(path.join(tempDir, 'cloudflare'), { recursive: true });
  await mkdir(path.join(tempDir, 'sites/mamamiya'), { recursive: true });

  const files = [
    'wrangler.cloudflare.toml',
    'cloudflare/wrangler.state.toml',
    'cloudflare/wrangler.server-public-web.toml',
    'cloudflare/wrangler.server-auth.toml',
    'cloudflare/wrangler.server-payment.toml',
    'cloudflare/wrangler.server-member.toml',
    'cloudflare/wrangler.server-chat.toml',
    'cloudflare/wrangler.server-admin.toml',
    'sites/mamamiya/site.config.json',
    'sites/mamamiya/deploy.settings.json',
  ];

  for (const file of files) {
    await cp(path.join(rootDir, file), path.join(tempDir, file));
  }
}

async function copySiteFixture(tempDir: string, siteKey: string) {
  const targetDir = path.join(tempDir, 'sites', siteKey);
  await mkdir(targetDir, { recursive: true });
  await cp(
    path.join(rootDir, 'sites', siteKey, 'site.config.json'),
    path.join(targetDir, 'site.config.json')
  );
  await cp(
    path.join(rootDir, 'sites', siteKey, 'deploy.settings.json'),
    path.join(targetDir, 'deploy.settings.json')
  );
  const previewSettingsPath = path.join(
    rootDir,
    'sites',
    siteKey,
    'deploy.preview.settings.json'
  );
  if (existsSync(previewSettingsPath)) {
    await cp(
      previewSettingsPath,
      path.join(targetDir, 'deploy.preview.settings.json')
    );
  }
}

async function withFixture(
  mutate: (tempDir: string) => Promise<void> | void = () => {}
) {
  await mkdir(os.tmpdir(), { recursive: true });
  const fixtureDir = await mkdtemp(path.join(os.tmpdir(), 'cf-check-fixture-'));

  await copyCloudflareConfigFixture(fixtureDir);
  await mutate(fixtureDir);

  return {
    fixtureDir,
    async cleanup() {
      await rm(fixtureDir, { recursive: true, force: true });
    },
  };
}

async function writeDeploySettings(
  tempDir: string,
  mutate: (current: Record<string, unknown>) => Record<string, unknown>
) {
  const configPath = path.join(tempDir, 'sites/mamamiya/deploy.settings.json');
  const current = JSON.parse(await readFile(configPath, 'utf8')) as Record<
    string,
    unknown
  >;
  await writeFile(
    configPath,
    JSON.stringify(mutate(current), null, 2) + '\n',
    'utf8'
  );
}

type DeployBindingRequirements = {
  secrets?: Record<string, unknown>;
};

async function runCheckCloudflareConfig({
  cwd,
  env = {},
  args = [],
}: {
  cwd: string;
  env?: Record<string, string | undefined>;
  args?: string[];
}) {
  const scriptPath = path.join(rootDir, 'scripts/check-cloudflare-config.mjs');
  const isolatedEnv: NodeJS.ProcessEnv = {
    ...process.env,
  };

  for (const secretName of requiredSecretEnvNames) {
    delete isolatedEnv[secretName];
  }
  delete isolatedEnv[storagePublicBaseUrlName];

  try {
    const childEnv: NodeJS.ProcessEnv = {
      ...isolatedEnv,
      SITE: 'mamamiya',
      ...env,
    };

    const result = await execFileAsync(
      process.execPath,
      [
        '--import',
        tsxLoader,
        '--eval',
        [
          `process.chdir(${JSON.stringify(cwd)});`,
          `process.argv = [process.argv[0], ${JSON.stringify(scriptPath)}, ${args.map((arg) => JSON.stringify(arg)).join(', ')}];`,
          `await import(${JSON.stringify(pathToFileURL(scriptPath).href)});`,
        ].join(' '),
      ],
      {
        cwd: rootDir,
        env: childEnv,
      }
    );

    return {
      ok: true as const,
      stdout: result.stdout,
      stderr: result.stderr,
    };
  } catch (error) {
    const execError = error as {
      stdout?: string;
      stderr?: string;
      code?: number;
    };

    return {
      ok: false as const,
      stdout: execError.stdout ?? '',
      stderr: execError.stderr ?? '',
      code: execError.code,
    };
  }
}

test('cf:check --workers=state 只校验 state worker 且不要求 auth secret 或 storage public binding', async () => {
  const fixture = await withFixture();

  try {
    const result = await runCheckCloudflareConfig({
      cwd: fixture.fixtureDir,
      args: ['--workers=state'],
      env: {
        [storagePublicBaseUrlName]: '',
      },
    });

    assert.equal(result.ok, true, result.stderr);
    assert.match(result.stdout, /workers: state/);
  } finally {
    await fixture.cleanup();
  }
});

test('cf:check --workers=app 仍要求 app server runtime auth secret', async () => {
  const fixture = await withFixture();

  try {
    const result = await runCheckCloudflareConfig({
      cwd: fixture.fixtureDir,
      args: ['--workers=app'],
      env: {
        [storagePublicBaseUrlName]: 'https://assets.example.com/',
      },
    });

    assert.equal(result.ok, false);
    assert.match(result.stderr, /BETTER_AUTH_SECRET or AUTH_SECRET/);
    assert.match(result.stderr, /server runtime shared auth secret/i);
  } finally {
    await fixture.cleanup();
  }
});

test('cf:check 在仅设置 BETTER_AUTH_SECRET 时通过 auth shared secret requirement', async () => {
  const fixture = await withFixture();

  try {
    const result = await runCheckCloudflareConfig({
      cwd: fixture.fixtureDir,
      env: {
        [storagePublicBaseUrlName]: 'https://assets.example.com/',
        BETTER_AUTH_SECRET: 'better-secret',
        RESEND_API_KEY: 'resend-key',
      },
    });

    assert.equal(result.ok, true, result.stderr);
  } finally {
    await fixture.cleanup();
  }
});

test('cf:check preview profile 使用 workers.dev router 且允许 placeholder secrets', async () => {
  const fixture = await withFixture(async (fixtureDir) => {
    await copySiteFixture(fixtureDir, 'ai-remover');
  });

  try {
    const result = await runCheckCloudflareConfig({
      cwd: fixture.fixtureDir,
      args: ['--workers=router,public-web'],
      env: {
        SITE: 'ai-remover',
        CF_DEPLOY_PROFILE: 'preview',
        CF_WORKERS_DEV_SUBDOMAIN: 'aooi-preview',
        CF_PREVIEW_ALLOW_PLACEHOLDER_SECRETS: 'true',
        [storagePublicBaseUrlName]: 'https://assets.example.com/',
      },
    });

    assert.equal(result.ok, true, result.stderr);
    assert.match(result.stdout, /workers: router, public-web/);
  } finally {
    await fixture.cleanup();
  }
});

test('cf:check preview auth worker 不要求 RESEND_API_KEY', async () => {
  const fixture = await withFixture(async (fixtureDir) => {
    await copySiteFixture(fixtureDir, 'ai-remover');
  });

  try {
    const result = await runCheckCloudflareConfig({
      cwd: fixture.fixtureDir,
      args: ['--workers=auth'],
      env: {
        SITE: 'ai-remover',
        CF_DEPLOY_PROFILE: 'preview',
        CF_WORKERS_DEV_SUBDOMAIN: 'aooi-preview',
        [storagePublicBaseUrlName]: 'https://assets.example.com/',
        BETTER_AUTH_SECRET: 'better-secret',
        GOOGLE_CLIENT_ID: 'google-id',
        GOOGLE_CLIENT_SECRET: 'google-secret',
      },
    });

    assert.equal(result.ok, true, result.stderr);
    assert.doesNotMatch(result.stderr, /RESEND_API_KEY/);
    assert.match(result.stdout, /workers: auth/);
  } finally {
    await fixture.cleanup();
  }
});

test('cf:check preview app 缺 CREEM secrets 时只警告不失败', async () => {
  const fixture = await withFixture(async (fixtureDir) => {
    await copySiteFixture(fixtureDir, 'ai-remover');
  });

  try {
    const result = await runCheckCloudflareConfig({
      cwd: fixture.fixtureDir,
      args: ['--workers=app'],
      env: {
        SITE: 'ai-remover',
        CF_DEPLOY_PROFILE: 'preview',
        CF_WORKERS_DEV_SUBDOMAIN: 'aooi-preview',
        [storagePublicBaseUrlName]: 'https://assets.example.com/',
        BETTER_AUTH_SECRET: 'better-secret',
        GOOGLE_CLIENT_ID: 'google-id',
        GOOGLE_CLIENT_SECRET: 'google-secret',
        REMOVER_CLEANUP_SECRET: 'cleanup-secret',
      },
    });

    assert.equal(result.ok, true, result.stderr);
    assert.match(result.stderr, /warning:.*CREEM_API_KEY/);
    assert.match(result.stderr, /warning:.*CREEM_SIGNING_SECRET/);
    assert.match(result.stdout, /workers: router, public-web, auth/);
    assert.doesNotMatch(result.stdout, /\bchat\b/);
  } finally {
    await fixture.cleanup();
  }
});

test('cf:check preview app 对 AI Remover 不要求 OPENROUTER_API_KEY', async () => {
  const fixture = await withFixture(async (fixtureDir) => {
    await copySiteFixture(fixtureDir, 'ai-remover');
  });

  try {
    const result = await runCheckCloudflareConfig({
      cwd: fixture.fixtureDir,
      args: ['--workers=app'],
      env: {
        SITE: 'ai-remover',
        CF_DEPLOY_PROFILE: 'preview',
        CF_WORKERS_DEV_SUBDOMAIN: 'aooi-preview',
        [storagePublicBaseUrlName]: 'https://assets.example.com/',
        BETTER_AUTH_SECRET: 'better-secret',
        GOOGLE_CLIENT_ID: 'google-id',
        GOOGLE_CLIENT_SECRET: 'google-secret',
        REMOVER_CLEANUP_SECRET: 'cleanup-secret',
      },
    });

    assert.equal(result.ok, true, result.stderr);
    assert.doesNotMatch(result.stderr, /OPENROUTER_API_KEY/);
    assert.match(result.stdout, /workers: router, public-web, auth/);
  } finally {
    await fixture.cleanup();
  }
});

test('cf:check 显式请求 disabled worker 时失败', async () => {
  const fixture = await withFixture(async (fixtureDir) => {
    await copySiteFixture(fixtureDir, 'ai-remover');
  });

  try {
    const result = await runCheckCloudflareConfig({
      cwd: fixture.fixtureDir,
      args: ['--workers=chat'],
      env: {
        SITE: 'ai-remover',
        CF_DEPLOY_PROFILE: 'preview',
        CF_WORKERS_DEV_SUBDOMAIN: 'aooi-preview',
        [storagePublicBaseUrlName]: 'https://assets.example.com/',
      },
    });

    assert.equal(result.ok, false);
    assert.match(result.stderr, /Cloudflare worker "chat" is disabled/);
  } finally {
    await fixture.cleanup();
  }
});

test('cf:check 在仅设置 AUTH_SECRET 时通过 auth shared secret requirement', async () => {
  const fixture = await withFixture();

  try {
    const result = await runCheckCloudflareConfig({
      cwd: fixture.fixtureDir,
      env: {
        [storagePublicBaseUrlName]: 'https://assets.example.com/',
        AUTH_SECRET: 'auth-secret',
        RESEND_API_KEY: 'resend-key',
      },
    });

    assert.equal(result.ok, true, result.stderr);
  } finally {
    await fixture.cleanup();
  }
});

test('cf:check 在 auth/admin worker 缺 RESEND_API_KEY 时直接失败', async () => {
  const fixture = await withFixture();

  try {
    const result = await runCheckCloudflareConfig({
      cwd: fixture.fixtureDir,
      args: ['--workers=auth'],
      env: {
        [storagePublicBaseUrlName]: 'https://assets.example.com/',
        BETTER_AUTH_SECRET: 'better-secret',
      },
    });

    assert.equal(result.ok, false);
    assert.match(result.stderr, /RESEND_API_KEY/);
    assert.match(result.stderr, /Email delivery provider/i);
  } finally {
    await fixture.cleanup();
  }
});

test('cf:check 拒绝未知 worker scope', async () => {
  const fixture = await withFixture();

  try {
    const result = await runCheckCloudflareConfig({
      cwd: fixture.fixtureDir,
      args: ['--workers=unknown-worker'],
      env: {
        [storagePublicBaseUrlName]: 'https://assets.example.com/',
      },
    });

    assert.equal(result.ok, false);
    assert.match(result.stderr, /Unknown Cloudflare worker/);
    assert.match(result.stderr, /state|app|all/);
  } finally {
    await fixture.cleanup();
  }
});

test('cf:check 缺少 storage public runtime binding 时失败', async () => {
  const fixture = await withFixture();

  try {
    const result = await runCheckCloudflareConfig({
      cwd: fixture.fixtureDir,
      env: {
        [storagePublicBaseUrlName]: '',
      },
    });

    assert.equal(result.ok, false);
    assert.match(result.stderr, /R2 public asset base URL/);
    assert.match(result.stderr, /runtime binding/);
    assert.match(result.stderr, /settings\/public-config/);
  } finally {
    await fixture.cleanup();
  }
});

test('cf:check 禁止 Cloudflare vars 回流站点 identity env', async () => {
  const fixture = await withFixture(async (fixtureDir) => {
    const configPath = path.join(fixtureDir, 'wrangler.cloudflare.toml');
    const content = await readFile(configPath, 'utf8');
    await writeFile(
      configPath,
      content.replace(
        `${appUrlEnvName} = "https://mamamiya.pdfreprinting.net/"`,
        [
          `${appUrlEnvName} = "https://mamamiya.pdfreprinting.net/"`,
          `${forbiddenIdentityEnvName} = "Roller Rabbit"`,
        ].join('\n')
      ),
      'utf8'
    );
  });

  try {
    const result = await runCheckCloudflareConfig({
      cwd: fixture.fixtureDir,
      env: {
        [storagePublicBaseUrlName]: 'https://assets.example.com/',
      },
    });

    assert.equal(result.ok, false);
    assert.match(result.stderr, /is forbidden/);
    assert.match(result.stderr, /site identity must come from @\/site/);
  } finally {
    await fixture.cleanup();
  }
});

test('cf:check 对当前 SITE 的语义源变更保持敏感，不读取 template 内联 app url', async () => {
  const fixture = await withFixture(async (fixtureDir) => {
    const configPath = path.join(fixtureDir, 'sites/mamamiya/site.config.json');
    const siteConfig = JSON.parse(await readFile(configPath, 'utf8'));
    await writeFile(
      configPath,
      JSON.stringify(
        {
          ...siteConfig,
          brand: {
            ...siteConfig.brand,
            appUrl: 'ftp://other.example.com/',
          },
        },
        null,
        2
      ) + '\n',
      'utf8'
    );
  });

  try {
    const result = await runCheckCloudflareConfig({
      cwd: fixture.fixtureDir,
      env: {
        [storagePublicBaseUrlName]: 'https://assets.example.com/',
        ...Object.fromEntries(
          requiredSecretEnvNames.map((name) => [
            name,
            `${name.toLowerCase()}_value`,
          ])
        ),
      },
    });

    assert.equal(result.ok, false);
    assert.match(result.stderr, /site\.brand\.appUrl/);
    assert.match(result.stderr, /must use http\/https|must be a valid URL/);
  } finally {
    await fixture.cleanup();
  }
});

test('cf:check 接受显式 storage public runtime binding', async () => {
  const fixture = await withFixture();

  try {
    const result = await runCheckCloudflareConfig({
      cwd: fixture.fixtureDir,
      env: {
        [storagePublicBaseUrlName]: 'https://assets.example.com/',
        ...Object.fromEntries(
          requiredSecretEnvNames.map((name) => [
            name,
            `${name.toLowerCase()}_value`,
          ])
        ),
      },
    });

    assert.equal(result.ok, true, result.stderr);
    assert.match(result.stdout, /Cloudflare config structure looks good/);
  } finally {
    await fixture.cleanup();
  }
});

test('cf:check 对 AI Remover public-web 要求 cleanup secret', async () => {
  const fixture = await withFixture(async (fixtureDir) => {
    await copySiteFixture(fixtureDir, 'ai-remover');
  });

  try {
    const result = await runCheckCloudflareConfig({
      cwd: fixture.fixtureDir,
      args: ['--workers=public-web'],
      env: {
        SITE: 'ai-remover',
        [storagePublicBaseUrlName]: 'https://assets.example.com/',
        BETTER_AUTH_SECRET: 'better-secret',
        GOOGLE_CLIENT_ID: 'google-client-id',
      },
    });

    assert.equal(result.ok, false);
    assert.match(result.stderr, /REMOVER_CLEANUP_SECRET/);
    assert.match(result.stderr, /AI Remover expiration cleanup/i);
  } finally {
    await fixture.cleanup();
  }
});

test('cf:check 拒绝任意两个已配置 site 复用同一 domain', async () => {
  const fixture = await withFixture(async (fixtureDir) => {
    await copySiteFixture(fixtureDir, 'dev-local');

    const devLocalConfigPath = path.join(
      fixtureDir,
      'sites/dev-local/site.config.json'
    );
    const devLocalConfig = JSON.parse(
      await readFile(devLocalConfigPath, 'utf8')
    );
    await writeFile(
      devLocalConfigPath,
      JSON.stringify(
        {
          ...devLocalConfig,
          domain: 'mamamiya.pdfreprinting.net',
          brand: {
            ...devLocalConfig.brand,
            appUrl: 'https://dev-local.example.com',
          },
        },
        null,
        2
      ) + '\n',
      'utf8'
    );
  });

  try {
    const result = await runCheckCloudflareConfig({
      cwd: fixture.fixtureDir,
      env: {
        [storagePublicBaseUrlName]: 'https://assets.example.com/',
        BETTER_AUTH_SECRET: 'better-secret',
        RESEND_API_KEY: 'resend-key',
      },
    });

    assert.equal(result.ok, false);
    assert.match(
      result.stderr,
      /duplicate site route pattern detected for "mamamiya\.pdfreprinting\.net" between dev-local and mamamiya/
    );
  } finally {
    await fixture.cleanup();
  }
});

test('cf:check 在默认禁用 provider 时只要求 server runtime auth secret，不要求 provider secrets', async () => {
  const fixture = await withFixture();

  try {
    const result = await runCheckCloudflareConfig({
      cwd: fixture.fixtureDir,
      env: {
        [storagePublicBaseUrlName]: 'https://assets.example.com/',
        BETTER_AUTH_SECRET: 'better-secret',
        RESEND_API_KEY: 'resend-key',
      },
    });

    assert.equal(result.ok, true, result.stderr);
  } finally {
    await fixture.cleanup();
  }
});

test('cf:check 仅对已启用 auth provider 要求对应 bindings', async () => {
  const fixture = await withFixture(async (fixtureDir) => {
    await writeDeploySettings(fixtureDir, (current) => ({
      ...current,
      bindingRequirements: {
        ...(current.bindingRequirements as Record<string, unknown>),
        secrets: {
          ...((
            current.bindingRequirements as DeployBindingRequirements | undefined
          )?.secrets ?? {}),
          googleOauth: true,
          githubOauth: true,
        },
      },
    }));
  });

  try {
    const result = await runCheckCloudflareConfig({
      cwd: fixture.fixtureDir,
      env: {
        [storagePublicBaseUrlName]: 'https://assets.example.com/',
        BETTER_AUTH_SECRET: 'better-secret',
        RESEND_API_KEY: 'resend-key',
        GOOGLE_CLIENT_ID: 'google-client-id',
        GITHUB_CLIENT_ID: 'github-client-id',
        GITHUB_CLIENT_SECRET: 'github-client-secret',
      },
    });

    assert.equal(result.ok, false);
    assert.match(result.stderr, /GOOGLE_CLIENT_ID|GOOGLE_CLIENT_SECRET/);
    assert.match(result.stderr, /Google auth provider/);
  } finally {
    await fixture.cleanup();
  }
});

test('cf:check 在 public-web worker 场景只要求 Google client id，不要求 Google secret', async () => {
  const fixture = await withFixture(async (fixtureDir) => {
    await writeDeploySettings(fixtureDir, (current) => ({
      ...current,
      bindingRequirements: {
        ...(current.bindingRequirements as Record<string, unknown>),
        secrets: {
          ...((
            current.bindingRequirements as DeployBindingRequirements | undefined
          )?.secrets ?? {}),
          googleOauth: true,
          githubOauth: false,
        },
      },
    }));
  });

  try {
    const result = await runCheckCloudflareConfig({
      cwd: fixture.fixtureDir,
      args: ['--workers=public-web'],
      env: {
        [storagePublicBaseUrlName]: 'https://assets.example.com/',
        BETTER_AUTH_SECRET: 'better-secret',
      },
    });

    assert.equal(result.ok, false);
    assert.match(result.stderr, /GOOGLE_CLIENT_ID/);
    assert.doesNotMatch(result.stderr, /GOOGLE_CLIENT_SECRET/);
    assert.match(result.stderr, /Google One Tap auth UI/);
  } finally {
    await fixture.cleanup();
  }
});

test('cf:check 在 chat worker 场景只要求 OPENROUTER_API_KEY', async () => {
  const fixture = await withFixture(async (fixtureDir) => {
    const siteConfigPath = path.join(
      fixtureDir,
      'sites/mamamiya/site.config.json'
    );
    const siteConfig = JSON.parse(await readFile(siteConfigPath, 'utf8'));
    await writeFile(
      siteConfigPath,
      JSON.stringify(
        {
          ...siteConfig,
          capabilities: {
            ...siteConfig.capabilities,
            ai: true,
          },
        },
        null,
        2
      ) + '\n',
      'utf8'
    );
  });

  try {
    const result = await runCheckCloudflareConfig({
      cwd: fixture.fixtureDir,
      env: {
        [storagePublicBaseUrlName]: 'https://assets.example.com/',
        BETTER_AUTH_SECRET: 'better-secret',
        RESEND_API_KEY: 'resend-key',
        OPENROUTER_API_KEY: 'openrouter-key',
      },
    });

    assert.equal(result.ok, true, result.stderr);
  } finally {
    await fixture.cleanup();
  }
});

test('cf:check 已启用能力缺 bindings 时给出 setting -> binding 错误', async () => {
  const fixture = await withFixture(async (fixtureDir) => {
    const siteConfigPath = path.join(
      fixtureDir,
      'sites/mamamiya/site.config.json'
    );
    const siteConfig = JSON.parse(await readFile(siteConfigPath, 'utf8'));
    await writeFile(
      siteConfigPath,
      JSON.stringify(
        {
          ...siteConfig,
          capabilities: {
            ...siteConfig.capabilities,
            ai: true,
          },
        },
        null,
        2
      ) + '\n',
      'utf8'
    );
  });

  try {
    const result = await runCheckCloudflareConfig({
      cwd: fixture.fixtureDir,
      env: {
        [storagePublicBaseUrlName]: 'https://assets.example.com/',
        BETTER_AUTH_SECRET: 'better-secret',
        RESEND_API_KEY: 'resend-key',
      },
    });

    assert.equal(result.ok, false);
    assert.match(result.stderr, /OPENROUTER_API_KEY/);
    assert.match(result.stderr, /Chat AI runtime/);
  } finally {
    await fixture.cleanup();
  }
});

test('cf:check 缺少 server runtime auth secret 时给出 worker 级错误', async () => {
  const fixture = await withFixture();

  try {
    const result = await runCheckCloudflareConfig({
      cwd: fixture.fixtureDir,
      env: {
        [storagePublicBaseUrlName]: 'https://assets.example.com/',
      },
    });

    assert.equal(result.ok, false);
    assert.match(result.stderr, /BETTER_AUTH_SECRET or AUTH_SECRET/);
    assert.match(result.stderr, /server runtime shared auth secret/i);
    assert.match(result.stderr, /worker auth|worker public-web|worker payment/);
  } finally {
    await fixture.cleanup();
  }
});

test('cf:check active payment provider 缺 secret 时带环境上下文并直接失败', async () => {
  const fixture = await withFixture(async (fixtureDir) => {
    const siteConfigPath = path.join(
      fixtureDir,
      'sites/mamamiya/site.config.json'
    );
    const siteConfig = JSON.parse(await readFile(siteConfigPath, 'utf8'));
    await writeFile(
      siteConfigPath,
      JSON.stringify(
        {
          ...siteConfig,
          capabilities: {
            ...siteConfig.capabilities,
            payment: 'stripe',
          },
        },
        null,
        2
      ) + '\n',
      'utf8'
    );
  });

  try {
    const result = await runCheckCloudflareConfig({
      cwd: fixture.fixtureDir,
      args: ['--workers=payment'],
      env: {
        NODE_ENV: 'production',
        DEPLOY_TARGET: 'cloudflare',
        [storagePublicBaseUrlName]: 'https://assets.example.com/',
        BETTER_AUTH_SECRET: 'better-secret',
      },
    });

    assert.equal(result.ok, false);
    assert.match(
      result.stderr,
      /STRIPE_PUBLISHABLE_KEY|STRIPE_SECRET_KEY|STRIPE_SIGNING_SECRET/
    );
    assert.match(result.stderr, /SITE=mamamiya/);
    assert.match(result.stderr, /NODE_ENV=production/);
    assert.match(result.stderr, /DEPLOY_TARGET=cloudflare/);
    assert.match(result.stderr, /workers=payment/);
  } finally {
    await fixture.cleanup();
  }
});
