import assert from 'node:assert/strict';
import test from 'node:test';
import { site } from '@/site';

import { resolveServerAuthBaseUrl } from '@/config/server-auth-base-url';

function createEnv(
  overrides: Record<string, string | undefined> = {}
): Record<string, string | undefined> {
  return {
    ...overrides,
    NODE_ENV: overrides.NODE_ENV ?? 'test',
  };
}

test('resolveServerAuthBaseUrl 默认使用 site.brand.appUrl origin', () => {
  assert.equal(resolveServerAuthBaseUrl(createEnv()), site.brand.appUrl);
});

test('resolveServerAuthBaseUrl 使用部署生成的 NEXT_PUBLIC_APP_URL 作为 runtime origin', () => {
  assert.equal(
    resolveServerAuthBaseUrl(
      createEnv({
        NEXT_PUBLIC_APP_URL:
          'https://aooi-ai-remover-preview-router.example.workers.dev',
      })
    ),
    'https://aooi-ai-remover-preview-router.example.workers.dev'
  );
});

test('resolveServerAuthBaseUrl 拒绝与 site.brand.appUrl 异源的 AUTH_URL', () => {
  assert.throws(
    () =>
      resolveServerAuthBaseUrl(
        createEnv({
          AUTH_URL: 'https://auth.example.com',
        })
      ),
    /AUTH_URL must share the same origin as the runtime app URL/
  );
});

test('resolveServerAuthBaseUrl 接受与 site.brand.appUrl 同源的 BETTER_AUTH_URL', () => {
  assert.equal(
    resolveServerAuthBaseUrl(
      createEnv({
        BETTER_AUTH_URL: `${site.brand.appUrl}/sign-in`,
      })
    ),
    site.brand.appUrl
  );
});

test('resolveServerAuthBaseUrl 接受与 preview runtime origin 同源的 BETTER_AUTH_URL', () => {
  assert.equal(
    resolveServerAuthBaseUrl(
      createEnv({
        NEXT_PUBLIC_APP_URL:
          'https://aooi-ai-remover-preview-router.example.workers.dev',
        BETTER_AUTH_URL:
          'https://aooi-ai-remover-preview-router.example.workers.dev/sign-in',
      })
    ),
    'https://aooi-ai-remover-preview-router.example.workers.dev'
  );
});
