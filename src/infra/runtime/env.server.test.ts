import assert from 'node:assert/strict';
import test from 'node:test';
import { site } from '@/site';

import {
  getRuntimeEnvString,
  getServerPublicEnvConfigs,
  getServerRuntimeEnv,
  isCloudflareWorkersRuntime,
  isRuntimeEnvEnabled,
  type CloudflareBindings,
} from './env.server';

function createEnv(
  overrides: Partial<NodeJS.ProcessEnv> = {}
): NodeJS.ProcessEnv {
  return {
    NODE_ENV: overrides.NODE_ENV ?? 'test',
    ...overrides,
  };
}

test('getRuntimeEnvString 优先读取 Cloudflare bindings 中的字符串值', () => {
  assert.equal(
    getRuntimeEnvString('NEXT_PUBLIC_APP_URL', {
      env: createEnv({ NEXT_PUBLIC_APP_URL: 'https://env.example.com' }),
      bindings: {
        NEXT_PUBLIC_APP_URL: 'https://binding.example.com',
      } as CloudflareBindings,
    }),
    'https://binding.example.com'
  );
});

test('getRuntimeEnvString 在无 bindings 值时回退到 process env', () => {
  assert.equal(
    getRuntimeEnvString('NEXT_PUBLIC_APP_URL', {
      env: createEnv({ NEXT_PUBLIC_APP_URL: 'https://env.example.com' }),
      bindings: null,
    }),
    'https://env.example.com'
  );
});

test('isRuntimeEnvEnabled 仅在显式 true 时返回 true', () => {
  assert.equal(
    isRuntimeEnvEnabled('AUTH_SPIKE_OAUTH_UPSTREAM_MOCK', {
      env: createEnv({ AUTH_SPIKE_OAUTH_UPSTREAM_MOCK: 'false' }),
      bindings: null,
    }),
    false
  );
  assert.equal(
    isRuntimeEnvEnabled('AUTH_SPIKE_OAUTH_UPSTREAM_MOCK', {
      env: createEnv({ AUTH_SPIKE_OAUTH_UPSTREAM_MOCK: 'true' }),
      bindings: null,
    }),
    true
  );
});

test('getServerPublicEnvConfigs 优先使用 runtime bindings 的公开配置', () => {
  const configs = getServerPublicEnvConfigs({
    env: createEnv({
      NEXT_PUBLIC_THEME: 'env-theme',
      NEXT_PUBLIC_DEFAULT_LOCALE: 'zh',
    }),
    bindings: {
      NEXT_PUBLIC_THEME: 'binding-theme',
      NEXT_PUBLIC_DEFAULT_LOCALE: 'en',
    } as CloudflareBindings,
  });

  assert.deepEqual(configs, {
    theme: 'binding-theme',
    locale: 'en',
  });
});

test('getServerPublicEnvConfigs 不承载站点 identity fallback', () => {
  const configs = getServerPublicEnvConfigs({
    env: createEnv({
      NODE_ENV: 'production',
    }),
    bindings: null,
  });

  assert.deepEqual(configs, {
    theme: 'default',
    locale: 'en',
  });
});

test('getServerRuntimeEnv 会从 runtime env 解析数据库和 auth 配置', () => {
  const runtimeEnv = getServerRuntimeEnv({
    env: createEnv({
      DATABASE_PROVIDER: 'postgresql',
      DATABASE_URL: 'postgres://env-db',
      DB_SINGLETON_ENABLED: 'false',
      AUTH_SECRET: 'env-secret',
    }),
    bindings: {
      DATABASE_PROVIDER: 'postgresql',
      DATABASE_URL: 'postgres://binding-db',
      DB_SINGLETON_ENABLED: 'true',
      BETTER_AUTH_SECRET: 'binding-secret',
    } as CloudflareBindings,
  });

  assert.deepEqual(runtimeEnv, {
    databaseProvider: 'postgresql',
    databaseUrl: 'postgres://binding-db',
    dbSingletonEnabled: true,
    authSecret: 'binding-secret',
    authBaseUrl: site.brand.appUrl,
  });
});

test('getServerRuntimeEnv 使用 runtime NEXT_PUBLIC_APP_URL 作为 auth base URL', () => {
  const runtimeEnv = getServerRuntimeEnv({
    env: createEnv({
      DATABASE_PROVIDER: 'postgresql',
      AUTH_SECRET: 'env-secret',
    }),
    bindings: {
      DATABASE_PROVIDER: 'postgresql',
      NEXT_PUBLIC_APP_URL:
        'https://aooi-ai-remover-preview-router.example.workers.dev',
    } as CloudflareBindings,
  });

  assert.equal(
    runtimeEnv.authBaseUrl,
    'https://aooi-ai-remover-preview-router.example.workers.dev'
  );
});

test('Node 运行时不会因为存在 Cloudflare bindings 误判为 Workers', () => {
  assert.equal(isCloudflareWorkersRuntime(), false);
});
