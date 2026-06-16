import assert from 'node:assert/strict';
import test from 'node:test';

import routerWorker from '../../cloudflare/workers/router';

type CapturedRequest = {
  url: string;
  headers: Headers;
};

function createServiceBinding(
  responseBody: string,
  captured: CapturedRequest[]
) {
  return {
    async fetch(request: Request) {
      captured.push({
        url: request.url,
        headers: new Headers(request.headers),
      });
      return new Response(responseBody, {
        headers: {
          'content-type': 'text/plain',
        },
      });
    },
  };
}

function createRouterEnv(captured: CapturedRequest[] = []) {
  return {
    PUBLIC_WEB_WORKER_NAME: 'public-web',
    MEMBER_WORKER_NAME: 'member',
    PUBLIC_WEB_WORKER: createServiceBinding('public', captured),
    MEMBER_WORKER: createServiceBinding('member', captured),
  };
}

test('router forwards native request metadata and security headers', async () => {
  const captured: CapturedRequest[] = [];
  const response = await routerWorker.fetch(
    new Request('https://example.test/pricing', {
      headers: {
        'x-request-id': 'req-test',
      },
    }),
    createRouterEnv(captured)
  );

  assert.equal(response.headers.get('x-request-id'), 'req-test');
  assert.equal(response.headers.get('x-pathname'), '/pricing');
  assert.equal(response.headers.get('x-url'), 'https://example.test/pricing');
  assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff');
  assert.match(
    response.headers.get('Content-Security-Policy') || '',
    /default-src 'self'/
  );
  assert.equal(captured.length, 1);
  assert.equal(captured[0]?.headers.get('x-request-id'), 'req-test');
  assert.equal(captured[0]?.headers.get('x-pathname'), '/pricing');
  assert.equal(
    captured[0]?.headers.get('x-url'),
    'https://example.test/pricing'
  );
});

test('router redirects unsigned protected requests before service binding fetch', async () => {
  const captured: CapturedRequest[] = [];
  const response = await routerWorker.fetch(
    new Request('https://example.test/settings/profile?tab=auth', {
      headers: {
        'x-request-id': 'req-protected',
      },
    }),
    createRouterEnv(captured)
  );

  assert.equal(response.status, 307);
  assert.equal(
    response.headers.get('location'),
    'https://example.test/sign-in?callbackUrl=%2Fsettings%2Fprofile%3Ftab%3Dauth'
  );
  assert.equal(response.headers.get('x-request-id'), 'req-protected');
  assert.equal(response.headers.get('X-Frame-Options'), 'SAMEORIGIN');
  assert.deepEqual(captured, []);
});

test('router forwards signed protected requests to the resolved split worker', async () => {
  const captured: CapturedRequest[] = [];
  const response = await routerWorker.fetch(
    new Request('https://example.test/settings/profile', {
      headers: {
        cookie: 'better-auth.session_token=session-token',
        'x-request-id': 'req-signed',
      },
    }),
    createRouterEnv(captured)
  );

  assert.equal(await response.text(), 'member');
  assert.equal(response.headers.get('x-request-id'), 'req-signed');
  assert.equal(captured.length, 1);
  assert.equal(captured[0]?.url, 'https://example.test/settings/profile');
  assert.equal(
    captured[0]?.headers.get('cookie'),
    'better-auth.session_token=session-token'
  );
});

test('router rewrites docs index while preserving original request headers', async () => {
  const captured: CapturedRequest[] = [];
  const response = await routerWorker.fetch(
    new Request('https://example.test/docs', {
      headers: {
        'x-request-id': 'req-docs',
      },
    }),
    createRouterEnv(captured)
  );

  assert.equal(await response.text(), 'public');
  assert.equal(captured.length, 1);
  assert.equal(captured[0]?.url, 'https://example.test/en/docs/index');
  assert.equal(captured[0]?.headers.get('x-pathname'), '/docs');
  assert.equal(captured[0]?.headers.get('x-url'), 'https://example.test/docs');
});
