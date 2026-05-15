import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  buildCloudflareSecretsEnv,
  resolveCloudflareAuthSecretValue,
} from '../../scripts/create-cf-secrets-file.mjs';
import { readCurrentSiteConfig } from '../../scripts/lib/site-config.mjs';
import {
  readSiteDeploySettings,
  resolveSiteDeploySettingsPath,
} from '../../scripts/lib/site-deploy-settings.mjs';

test('resolveCloudflareAuthSecretValue 优先 BETTER_AUTH_SECRET，其次 AUTH_SECRET', () => {
  assert.equal(
    resolveCloudflareAuthSecretValue({
      BETTER_AUTH_SECRET: 'better-secret',
      AUTH_SECRET: 'auth-secret',
    }),
    'better-secret'
  );
  assert.equal(
    resolveCloudflareAuthSecretValue({
      AUTH_SECRET: 'auth-secret',
    }),
    'auth-secret'
  );
});

test('buildCloudflareSecretsEnv 只输出白名单 secret，并为缺失项补同一 auth secret', () => {
  const content = buildCloudflareSecretsEnv(
    {
      BETTER_AUTH_SECRET: 'better-secret',
      RESEND_API_KEY: 'resend-key',
      OTHER_SECRET: 'ignored',
      SITE: 'mamamiya',
    },
    {
      workerKeys: ['auth'],
    }
  );

  assert.equal(
    content,
    [
      'BETTER_AUTH_SECRET=better-secret',
      'AUTH_SECRET=better-secret',
      'RESEND_API_KEY=resend-key',
      '',
    ].join('\n')
  );
});

test('buildCloudflareSecretsEnv 仅提供 AUTH_SECRET 时仍双写输出 auth shared secret', () => {
  const content = buildCloudflareSecretsEnv(
    {
      AUTH_SECRET: 'auth-secret',
      RESEND_API_KEY: 'resend-key',
      SITE: 'mamamiya',
    },
    {
      workerKeys: ['auth'],
    }
  );

  assert.equal(
    content,
    [
      'BETTER_AUTH_SECRET=auth-secret',
      'AUTH_SECRET=auth-secret',
      'RESEND_API_KEY=resend-key',
      '',
    ].join('\n')
  );
});

test('buildCloudflareSecretsEnv 缺少 workerKeys 时失败', () => {
  assert.throws(
    () =>
      buildCloudflareSecretsEnv({
        BETTER_AUTH_SECRET: 'better-secret',
        SITE: 'mamamiya',
      }),
    /worker scope is required/i
  );
});

test('buildCloudflareSecretsEnv 在 state worker 缺少 auth secret 时不失败', () => {
  const content = buildCloudflareSecretsEnv(
    {
      SITE: 'mamamiya',
    },
    {
      workerKeys: ['state'],
    }
  );

  assert.equal(content, '\n');
});

test('buildCloudflareSecretsEnv 在 server worker 缺少 auth secret 时失败', () => {
  assert.throws(
    () =>
      buildCloudflareSecretsEnv(
        {
          SITE: 'mamamiya',
        },
        {
          workerKeys: ['auth'],
        }
      ),
    /BETTER_AUTH_SECRET or AUTH_SECRET/i
  );
});

test('buildCloudflareSecretsEnv 仅在 preview profile 允许缺失 secret 占位', () => {
  const runtimeSettings = {
    secrets: {
      authSharedSecret: true,
      googleOauth: true,
      githubOauth: false,
      emailProvider: true,
      openrouter: false,
      removerCleanup: false,
    },
    vars: {
      storagePublicBaseUrl: false,
    },
    payment: {
      provider: null,
    },
  };

  const content = buildCloudflareSecretsEnv(
    {
      SITE: 'ai-remover',
      CF_DEPLOY_PROFILE: 'preview',
      CF_PREVIEW_ALLOW_PLACEHOLDER_SECRETS: 'true',
    },
    {
      workerKeys: ['auth'],
      runtimeSettings,
    }
  );

  assert.match(
    content,
    /BETTER_AUTH_SECRET=preview-placeholder-auth-shared-secret-not-for-production/
  );
  assert.match(
    content,
    /AUTH_SECRET=preview-placeholder-auth-shared-secret-not-for-production/
  );
  assert.match(
    content,
    /GOOGLE_CLIENT_ID=preview-placeholder-google-client-id-not-for-production/
  );
  assert.match(
    content,
    /RESEND_API_KEY=preview-placeholder-resend-api-key-not-for-production/
  );

  assert.throws(
    () =>
      buildCloudflareSecretsEnv(
        {
          SITE: 'ai-remover',
          CF_DEPLOY_PROFILE: 'production',
          CF_PREVIEW_ALLOW_PLACEHOLDER_SECRETS: 'true',
        },
        {
          workerKeys: ['auth'],
          runtimeSettings,
        }
      ),
    /BETTER_AUTH_SECRET or AUTH_SECRET/i
  );
});

test('buildCloudflareSecretsEnv 在 auth/admin worker 缺少 RESEND_API_KEY 时失败', () => {
  assert.throws(
    () =>
      buildCloudflareSecretsEnv(
        {
          SITE: 'mamamiya',
          BETTER_AUTH_SECRET: 'better-secret',
        },
        {
          workerKeys: ['auth'],
        }
      ),
    /RESEND_API_KEY is required/
  );
});

test('buildCloudflareSecretsEnv 不会把 RESEND_API_KEY 扩散到非 allowlist worker', () => {
  const content = buildCloudflareSecretsEnv(
    {
      SITE: 'mamamiya',
      BETTER_AUTH_SECRET: 'better-secret',
      RESEND_API_KEY: 'resend-key',
    },
    {
      workerKeys: ['payment'],
    }
  );

  assert.doesNotMatch(content, /RESEND_API_KEY=/);
});

test('buildCloudflareSecretsEnv 只向 public-web 输出 remover cleanup secret', () => {
  const publicWebContent = buildCloudflareSecretsEnv(
    {
      SITE: 'ai-remover',
      BETTER_AUTH_SECRET: 'better-secret',
      GOOGLE_CLIENT_ID: 'google-id',
      REMOVER_CLEANUP_SECRET: 'cleanup-secret',
    },
    {
      workerKeys: ['public-web'],
    }
  );

  assert.match(publicWebContent, /GOOGLE_CLIENT_ID=google-id/);
  assert.match(publicWebContent, /REMOVER_CLEANUP_SECRET=cleanup-secret/);

  const authContent = buildCloudflareSecretsEnv(
    {
      SITE: 'ai-remover',
      BETTER_AUTH_SECRET: 'better-secret',
      RESEND_API_KEY: 'resend-key',
      GOOGLE_CLIENT_ID: 'google-id',
      GOOGLE_CLIENT_SECRET: 'google-secret',
      REMOVER_CLEANUP_SECRET: 'cleanup-secret',
    },
    {
      workerKeys: ['auth'],
    }
  );

  assert.doesNotMatch(authContent, /REMOVER_CLEANUP_SECRET=/);
});

test('buildCloudflareSecretsEnv 缺少 remover cleanup secret 时失败', () => {
  assert.throws(
    () =>
      buildCloudflareSecretsEnv(
        {
          SITE: 'ai-remover',
          BETTER_AUTH_SECRET: 'better-secret',
          GOOGLE_CLIENT_ID: 'google-id',
        },
        {
          workerKeys: ['public-web'],
        }
      ),
    /REMOVER_CLEANUP_SECRET is required/
  );
});

test('buildCloudflareSecretsEnv 仅输出当前启用能力所需 secrets', () => {
  const content = buildCloudflareSecretsEnv(
    {
      BETTER_AUTH_SECRET: 'better-secret',
      RESEND_API_KEY: 'resend-key',
      SITE: 'mamamiya',
      GOOGLE_CLIENT_ID: 'google-id',
      GOOGLE_CLIENT_SECRET: 'google-secret',
      GITHUB_CLIENT_ID: 'github-id',
      GITHUB_CLIENT_SECRET: 'github-secret',
      OPENROUTER_API_KEY: 'or-key',
      PAYPAL_CLIENT_ID: 'paypal-id',
    },
    {
      workerKeys: ['auth', 'payment', 'member', 'chat'],
    }
  );

  assert.doesNotMatch(content, /GOOGLE_CLIENT_ID=google-id/);
  assert.doesNotMatch(content, /GOOGLE_CLIENT_SECRET=google-secret/);
  assert.doesNotMatch(content, /GITHUB_CLIENT_ID=github-id/);
  assert.doesNotMatch(content, /GITHUB_CLIENT_SECRET=github-secret/);
  assert.doesNotMatch(content, /OPENROUTER_API_KEY=or-key/);
  assert.doesNotMatch(content, /PAYPAL_CLIENT_ID=paypal-id/);
  assert.doesNotMatch(content, /STRIPE_SECRET_KEY=/);
  assert.doesNotMatch(content, /REPLICATE_API_TOKEN=/);
});

test('buildCloudflareSecretsEnv 按 deploy.settings.json 与 workerKeys 限定 secrets 输出范围', async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'cf-secrets-site-'));
  const sourcePath = resolveSiteDeploySettingsPath({
    rootDir: process.cwd(),
    siteKey: 'mamamiya',
  });
  const targetDir = path.join(tempDir, 'sites/mamamiya');
  const targetPath = path.join(targetDir, 'deploy.settings.json');

  try {
    await mkdir(targetDir, { recursive: true });
    await writeFile(
      path.join(targetDir, 'site.config.json'),
      JSON.stringify(
        {
          ...readCurrentSiteConfig({ siteKey: 'mamamiya' }),
          capabilities: {
            ...readCurrentSiteConfig({ siteKey: 'mamamiya' }).capabilities,
            auth: true,
            ai: false,
            payment: 'none',
          },
        },
        null,
        2
      ) + '\n',
      'utf8'
    );
    await writeFile(
      targetPath,
      JSON.stringify(
        {
          ...readSiteDeploySettings({ siteKey: 'mamamiya' }),
          bindingRequirements: {
            ...readSiteDeploySettings({ siteKey: 'mamamiya' })
              .bindingRequirements,
            secrets: {
              ...readSiteDeploySettings({ siteKey: 'mamamiya' })
                .bindingRequirements.secrets,
              googleOauth: true,
            },
          },
        },
        null,
        2
      ) + '\n',
      'utf8'
    );
  } catch {
    await rm(tempDir, { recursive: true, force: true });
    throw new Error(
      `failed to prepare deploy settings fixture from ${sourcePath}`
    );
  }

  try {
    const originalSite = process.env.SITE;
    delete process.env.SITE;
    const originalCwd = process.cwd();
    process.chdir(tempDir);

    try {
      const content = buildCloudflareSecretsEnv(
        {
          BETTER_AUTH_SECRET: 'better-secret',
          RESEND_API_KEY: 'resend-key',
          SITE: 'mamamiya',
          GOOGLE_CLIENT_ID: 'google-id',
          GOOGLE_CLIENT_SECRET: 'google-secret',
          STRIPE_PUBLISHABLE_KEY: 'pk',
          STRIPE_SECRET_KEY: 'sk',
          STRIPE_SIGNING_SECRET: 'ss',
        },
        {
          workerKeys: ['auth'],
        }
      );

      assert.match(content, /GOOGLE_CLIENT_ID=google-id/);
      assert.match(content, /GOOGLE_CLIENT_SECRET=google-secret/);
      assert.doesNotMatch(content, /STRIPE_PUBLISHABLE_KEY=pk/);
      assert.doesNotMatch(content, /STRIPE_SECRET_KEY=sk/);
    } finally {
      process.chdir(originalCwd);
      if (originalSite === undefined) {
        delete process.env.SITE;
      } else {
        process.env.SITE = originalSite;
      }
    }
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test('buildCloudflareSecretsEnv 对 public-web 仅输出 Google One Tap 所需 client id', async () => {
  const tempDir = await mkdtemp(
    path.join(os.tmpdir(), 'cf-secrets-site-public-web-')
  );
  const sourcePath = resolveSiteDeploySettingsPath({
    rootDir: process.cwd(),
    siteKey: 'mamamiya',
  });
  const targetDir = path.join(tempDir, 'sites/mamamiya');
  const targetPath = path.join(targetDir, 'deploy.settings.json');

  try {
    await mkdir(targetDir, { recursive: true });
    await writeFile(
      path.join(targetDir, 'site.config.json'),
      JSON.stringify(
        {
          ...readCurrentSiteConfig({ siteKey: 'mamamiya' }),
          capabilities: {
            ...readCurrentSiteConfig({ siteKey: 'mamamiya' }).capabilities,
            auth: true,
            ai: false,
            payment: 'none',
          },
        },
        null,
        2
      ) + '\n',
      'utf8'
    );
    await writeFile(
      targetPath,
      JSON.stringify(
        {
          ...readSiteDeploySettings({ siteKey: 'mamamiya' }),
          bindingRequirements: {
            ...readSiteDeploySettings({ siteKey: 'mamamiya' })
              .bindingRequirements,
            secrets: {
              ...readSiteDeploySettings({ siteKey: 'mamamiya' })
                .bindingRequirements.secrets,
              googleOauth: true,
            },
          },
        },
        null,
        2
      ) + '\n',
      'utf8'
    );
  } catch {
    await rm(tempDir, { recursive: true, force: true });
    throw new Error(
      `failed to prepare deploy settings fixture from ${sourcePath}`
    );
  }

  try {
    const originalSite = process.env.SITE;
    delete process.env.SITE;
    const originalCwd = process.cwd();
    process.chdir(tempDir);

    try {
      const content = buildCloudflareSecretsEnv(
        {
          BETTER_AUTH_SECRET: 'better-secret',
          SITE: 'mamamiya',
          GOOGLE_CLIENT_ID: 'google-id',
          GOOGLE_CLIENT_SECRET: 'google-secret',
        },
        {
          workerKeys: ['public-web'],
        }
      );

      assert.match(content, /GOOGLE_CLIENT_ID=google-id/);
      assert.doesNotMatch(content, /GOOGLE_CLIENT_SECRET=google-secret/);
      assert.doesNotMatch(content, /GITHUB_CLIENT_ID=/);
      assert.doesNotMatch(content, /GITHUB_CLIENT_SECRET=/);
    } finally {
      process.chdir(originalCwd);
      if (originalSite === undefined) {
        delete process.env.SITE;
      } else {
        process.env.SITE = originalSite;
      }
    }
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test('buildCloudflareSecretsEnv 对 payment capability 推导的 active provider 缺 secret 时直接失败，并带环境上下文', () => {
  assert.throws(
    () =>
      buildCloudflareSecretsEnv(
        {
          SITE: 'mamamiya',
          NODE_ENV: 'production',
          DEPLOY_TARGET: 'cloudflare',
          BETTER_AUTH_SECRET: 'better-secret',
        },
        {
          workerKeys: ['payment'],
          runtimeSettings: {
            secrets: {
              authSharedSecret: true,
              googleOauth: false,
              githubOauth: false,
              openrouter: false,
            },
            vars: {
              storagePublicBaseUrl: true,
            },
            payment: {
              capability: 'stripe',
              provider: 'stripe',
              requiredSecrets: [
                'STRIPE_PUBLISHABLE_KEY',
                'STRIPE_SECRET_KEY',
                'STRIPE_SIGNING_SECRET',
              ],
              requiresSecrets: true,
            },
          },
        }
      ),
    /SITE=mamamiya.*NODE_ENV=production.*DEPLOY_TARGET=cloudflare.*workers=payment/i
  );
});
