import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildTrustedAuthOrigins,
  isExplicitLocalAuthRuntimeEnabled,
  isLocalAuthRuntimeOrigin,
  resolveRuntimeAuthBaseUrl,
} from './runtime-origin';

test('isLocalAuthRuntimeOrigin 接受 localhost 的 Wrangler 动态端口', () => {
  assert.equal(isLocalAuthRuntimeOrigin('http://localhost:8788'), true);
});

test('isLocalAuthRuntimeOrigin 接受 127.0.0.1 的 Wrangler 动态端口', () => {
  assert.equal(isLocalAuthRuntimeOrigin('http://127.0.0.1:40123'), true);
});

test('isLocalAuthRuntimeOrigin 拒绝非本机 origin', () => {
  assert.equal(isLocalAuthRuntimeOrigin('https://example.com'), false);
});

test('buildTrustedAuthOrigins 会加入请求里的 localhost preview origin', () => {
  const request = new Request('http://localhost:8788/api/auth/sign-in/social', {
    headers: {
      origin: 'http://localhost:8788',
    },
  });

  assert.deepEqual(
    buildTrustedAuthOrigins({
      appUrl: 'https://mamamiya.pdfreprinting.net',
      request,
      env: { CF_LOCAL_SMOKE_WORKERS_DEV: 'true' },
    }).sort(),
    [
      'http://127.0.0.1:8787',
      'http://localhost:8787',
      'http://localhost:8788',
      'https://accounts.google.com',
      'https://mamamiya.pdfreprinting.net',
    ].sort()
  );
});

test('buildTrustedAuthOrigins 会从 Host 头识别 Wrangler preview origin', () => {
  const request = new Request(
    'https://mamamiya.pdfreprinting.net/api/auth/sign-in/social',
    {
      headers: {
        host: 'localhost:8787',
      },
    }
  );

  assert.equal(
    buildTrustedAuthOrigins({
      appUrl: 'https://mamamiya.pdfreprinting.net',
      request,
      env: { CF_LOCAL_SMOKE_WORKERS_DEV: 'true' },
    }).includes('http://localhost:8787'),
    true
  );
});

test('resolveRuntimeAuthBaseUrl 优先使用请求里的 localhost preview origin', () => {
  const request = new Request('http://localhost:8788/api/auth/sign-in/social', {
    headers: {
      origin: 'http://localhost:8788',
    },
  });

  assert.equal(
    resolveRuntimeAuthBaseUrl({
      defaultBaseUrl: 'https://mamamiya.pdfreprinting.net',
      request,
      env: { CF_LOCAL_SMOKE_WORKERS_DEV: 'true' },
    }),
    'http://localhost:8788'
  );
});

test('resolveRuntimeAuthBaseUrl 在 request.url 是配置域时仍优先使用本地 Host', () => {
  const request = new Request(
    'https://mamamiya.pdfreprinting.net/api/auth/sign-in/social',
    {
      headers: {
        host: 'localhost:8787',
      },
    }
  );

  assert.equal(
    resolveRuntimeAuthBaseUrl({
      defaultBaseUrl: 'https://mamamiya.pdfreprinting.net',
      request,
      env: { CF_LOCAL_SMOKE_WORKERS_DEV: 'true' },
    }),
    'http://localhost:8787'
  );
});

test('resolveRuntimeAuthBaseUrl 在请求头已提供本地 origin 时忽略异源 request.url', () => {
  const request = new Request(
    'https://mamamiya.pdfreprinting.net/api/auth/sign-in/social',
    {
      headers: {
        origin: 'http://localhost:8787',
        host: 'localhost:8787',
      },
    }
  );

  assert.equal(
    resolveRuntimeAuthBaseUrl({
      defaultBaseUrl: 'http://localhost:8787',
      request,
      env: { CF_LOCAL_SMOKE_WORKERS_DEV: 'true' },
    }),
    'http://localhost:8787'
  );
});

test('buildTrustedAuthOrigins 会把 split worker 丢失端口的 localhost 请求收敛回 canonical 本地 preview origin', () => {
  const request = new Request('http://localhost/api/auth/callback/google', {
    headers: {
      origin: 'http://localhost',
      host: 'localhost',
      'x-forwarded-host': 'localhost',
      'x-forwarded-proto': 'http',
    },
  });

  assert.deepEqual(
    buildTrustedAuthOrigins({
      appUrl: 'http://localhost:8787',
      request,
      env: { AUTH_SPIKE_OAUTH_UPSTREAM_MOCK: 'true' },
    }).sort(),
    [
      'http://127.0.0.1:8787',
      'http://localhost',
      'http://localhost:8787',
      'https://accounts.google.com',
    ].sort()
  );
});

test('resolveRuntimeAuthBaseUrl 会把 split worker 丢失端口的 localhost 请求收敛回 canonical 本地 preview origin', () => {
  const request = new Request('http://localhost/api/auth/callback/google', {
    headers: {
      origin: 'http://localhost',
      host: 'localhost',
      'x-forwarded-host': 'localhost',
      'x-forwarded-proto': 'http',
    },
  });

  assert.equal(
    resolveRuntimeAuthBaseUrl({
      defaultBaseUrl: 'http://localhost:8787',
      request,
      env: { AUTH_SPIKE_OAUTH_UPSTREAM_MOCK: 'true' },
    }),
    'http://localhost:8787'
  );
});

test('buildTrustedAuthOrigins 在本地 canonical 与构建期 app origin 并存时接受构建期 origin', () => {
  const request = new Request(
    'http://mamamiya.pdfreprinting.net/api/auth/sign-up/email',
    {
      headers: {
        origin: 'http://mamamiya.pdfreprinting.net',
        host: 'mamamiya.pdfreprinting.net',
        'x-forwarded-host': 'mamamiya.pdfreprinting.net',
        'x-forwarded-proto': 'http',
      },
    }
  );

  assert.deepEqual(
    buildTrustedAuthOrigins({
      appUrl: 'http://localhost:8787',
      additionalAllowedOrigins: ['https://mamamiya.pdfreprinting.net'],
      request,
    }).sort(),
    [
      'http://localhost:8787',
      'https://accounts.google.com',
      'https://mamamiya.pdfreprinting.net',
    ].sort()
  );
});

test('resolveRuntimeAuthBaseUrl 在本地 canonical 与构建期 app origin 并存时仍返回本地 canonical', () => {
  const request = new Request(
    'http://mamamiya.pdfreprinting.net/api/auth/sign-up/email',
    {
      headers: {
        origin: 'http://mamamiya.pdfreprinting.net',
        host: 'mamamiya.pdfreprinting.net',
        'x-forwarded-host': 'mamamiya.pdfreprinting.net',
        'x-forwarded-proto': 'http',
      },
    }
  );

  assert.equal(
    resolveRuntimeAuthBaseUrl({
      defaultBaseUrl: 'http://localhost:8787',
      additionalAllowedOrigins: ['https://mamamiya.pdfreprinting.net'],
      request,
    }),
    'http://localhost:8787'
  );
});

test('buildTrustedAuthOrigins 在请求头已提供本地 origin 时忽略异源 request.url', () => {
  const request = new Request(
    'https://mamamiya.pdfreprinting.net/api/auth/get-session',
    {
      headers: {
        origin: 'http://localhost:8787',
        host: 'localhost:8787',
      },
    }
  );

  assert.deepEqual(
    buildTrustedAuthOrigins({
      appUrl: 'http://localhost:8787',
      request,
      env: { CF_LOCAL_SMOKE_WORKERS_DEV: 'true' },
    }).sort(),
    [
      'http://127.0.0.1:8787',
      'http://localhost:8787',
      'https://accounts.google.com',
    ].sort()
  );
});

test('buildTrustedAuthOrigins 会把同 host 的 http preview 变体收敛回 canonical https origin', () => {
  const request = new Request(
    'http://mamamiya.pdfreprinting.net/api/auth/get-session',
    {
      headers: {
        host: 'mamamiya.pdfreprinting.net',
      },
    }
  );

  assert.deepEqual(
    buildTrustedAuthOrigins({
      appUrl: 'https://mamamiya.pdfreprinting.net',
      request,
    }).sort(),
    ['https://accounts.google.com', 'https://mamamiya.pdfreprinting.net'].sort()
  );
});

test('resolveRuntimeAuthBaseUrl 会把同 host 的 http preview 变体收敛回 canonical https origin', () => {
  const request = new Request(
    'http://mamamiya.pdfreprinting.net/api/auth/get-session',
    {
      headers: {
        host: 'mamamiya.pdfreprinting.net',
      },
    }
  );

  assert.equal(
    resolveRuntimeAuthBaseUrl({
      defaultBaseUrl: 'https://mamamiya.pdfreprinting.net',
      request,
    }),
    'https://mamamiya.pdfreprinting.net'
  );
});

test('resolveRuntimeAuthBaseUrl 在 mock 模式优先使用请求 origin', () => {
  const request = new Request(
    'https://localhost:8788/api/auth/sign-in/social',
    {
      headers: {
        origin: 'http://localhost:8788',
      },
    }
  );

  assert.equal(
    resolveRuntimeAuthBaseUrl({
      defaultBaseUrl: 'https://localhost:8788',
      preferRequestOrigin: true,
      request,
    }),
    'http://localhost:8788'
  );
});

test('isExplicitLocalAuthRuntimeEnabled 仅在显式本地模式下返回 true', () => {
  assert.equal(isExplicitLocalAuthRuntimeEnabled({ env: {} }), false);
  assert.equal(
    isExplicitLocalAuthRuntimeEnabled({
      env: { CF_LOCAL_SMOKE_WORKERS_DEV: 'true' },
    }),
    true
  );
  assert.equal(
    isExplicitLocalAuthRuntimeEnabled({
      env: { AUTH_SPIKE_OAUTH_UPSTREAM_MOCK: 'true' },
    }),
    true
  );
  assert.equal(
    isExplicitLocalAuthRuntimeEnabled({
      env: {},
      preferRequestOrigin: true,
    }),
    true
  );
});

test('buildTrustedAuthOrigins 默认忽略 localhost request origin，不把它加入 trusted origins', () => {
  const request = new Request(
    'https://mamamiya.pdfreprinting.net/api/auth/get-session',
    {
      headers: {
        origin: 'http://localhost:9999',
        host: 'localhost:9999',
      },
    }
  );

  assert.deepEqual(
    buildTrustedAuthOrigins({
      appUrl: 'https://mamamiya.pdfreprinting.net',
      request,
      env: {},
    }).sort(),
    ['https://accounts.google.com', 'https://mamamiya.pdfreprinting.net'].sort()
  );
});

test('resolveRuntimeAuthBaseUrl 默认忽略 localhost request origin，继续返回 canonical origin', () => {
  const request = new Request(
    'https://mamamiya.pdfreprinting.net/api/auth/get-session',
    {
      headers: {
        origin: 'http://localhost:9999',
        host: 'localhost:9999',
      },
    }
  );

  assert.equal(
    resolveRuntimeAuthBaseUrl({
      defaultBaseUrl: 'https://mamamiya.pdfreprinting.net',
      request,
      env: {},
    }),
    'https://mamamiya.pdfreprinting.net'
  );
});

test('resolveRuntimeAuthBaseUrl 不把第三方 referer 当成 runtime origin', () => {
  const request = new Request(
    'https://mamamiya.pdfreprinting.net/api/auth/callback/google',
    {
      headers: {
        referer: 'https://accounts.google.com/o/oauth2/auth',
        host: 'mamamiya.pdfreprinting.net',
      },
    }
  );

  assert.equal(
    resolveRuntimeAuthBaseUrl({
      defaultBaseUrl: 'https://mamamiya.pdfreprinting.net',
      request,
    }),
    'https://mamamiya.pdfreprinting.net'
  );
});

test('buildTrustedAuthOrigins 拒绝非 canonical 且非本地 preview origin', () => {
  const request = new Request(
    'https://evil.example.com/api/auth/sign-in/social',
    {
      headers: {
        origin: 'https://evil.example.com',
      },
    }
  );

  assert.throws(
    () =>
      buildTrustedAuthOrigins({
        appUrl: 'https://mamamiya.pdfreprinting.net',
        request,
      }),
    /Unexpected runtime auth origin/
  );
});

test('resolveRuntimeAuthBaseUrl 拒绝非 canonical 且非本地 preview origin', () => {
  const request = new Request(
    'https://evil.example.com/api/auth/sign-in/social',
    {
      headers: {
        host: 'evil.example.com',
      },
    }
  );

  assert.throws(
    () =>
      resolveRuntimeAuthBaseUrl({
        defaultBaseUrl: 'https://mamamiya.pdfreprinting.net',
        request,
      }),
    /Unexpected runtime auth origin/
  );
});
