import assert from 'node:assert/strict';
import test from 'node:test';
import { NextRequest } from 'next/server';

function assertSecurityHeaders(response: Response) {
  assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff');
  assert.equal(
    response.headers.get('Referrer-Policy'),
    'strict-origin-when-cross-origin'
  );
  assert.equal(response.headers.get('X-Frame-Options'), 'SAMEORIGIN');
  assert.match(
    response.headers.get('Permissions-Policy') ?? '',
    /camera=\(\)/
  );
  const csp = response.headers.get('Content-Security-Policy') ?? '';
  assert.match(csp, /default-src 'self'/);
  assert.match(csp, /frame-ancestors 'self'/);
  assert.match(csp, /object-src 'none'/);
  const connectSrc = csp
    .split(';')
    .map((directive) => directive.trim())
    .find((directive) => directive.startsWith('connect-src '));
  assert.ok(connectSrc);
  assert.equal(connectSrc.split(/\s+/).includes('https:'), false);
}

test('/api 请求会保留原始 request headers，并额外注入 x-request-id', async () => {
  const middlewareModule = await import('./middleware');
  const middleware = middlewareModule.middleware;

  assert.equal(typeof middleware, 'function');

  const request = new NextRequest(
    'https://example.com/api/auth/sign-up/email',
    {
      headers: {
        'content-type': 'application/json',
        'x-auth-smoke': '1',
      },
    }
  );

  const response = await middleware(request);
  const overrideHeaders = (
    response.headers.get('x-middleware-override-headers') ?? ''
  ).split(',');

  assert.equal(
    response.headers.get('x-middleware-request-content-type'),
    'application/json'
  );
  assert.equal(
    response.headers.get('x-middleware-request-x-pathname'),
    '/api/auth/sign-up/email'
  );
  assert.equal(
    response.headers.get('x-middleware-request-x-url'),
    'https://example.com/api/auth/sign-up/email'
  );
  assert.equal(response.headers.get('x-middleware-request-x-auth-smoke'), '1');
  assert.ok(overrideHeaders.includes('content-type'));
  assert.ok(overrideHeaders.includes('x-pathname'));
  assert.ok(overrideHeaders.includes('x-url'));
  assert.ok(overrideHeaders.includes('x-auth-smoke'));

  const requestId = response.headers.get('x-request-id');
  assert.ok(requestId);
  assert.equal(
    response.headers.get('x-middleware-request-x-request-id'),
    requestId
  );
  assert.ok(overrideHeaders.includes('x-request-id'));
  assertSecurityHeaders(response);
});

test('非 API 请求会带全局安全响应头', async () => {
  const middlewareModule = await import('./middleware');
  const middleware = middlewareModule.middleware;

  const response = await middleware(new NextRequest('https://example.com/en'));

  assertSecurityHeaders(response);
});

test('根路径内部 rewrite 到默认语言时不会暴露 redirect header', async () => {
  const middlewareModule = await import('./middleware');
  const middleware = middlewareModule.middleware;

  const response = await middleware(new NextRequest('https://example.com/'));

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('location'), null);
  assert.match(response.headers.get('x-middleware-rewrite') ?? '', /\/en$/);
  assertSecurityHeaders(response);
});

test('默认语言路径不会被 middleware canonical redirect 回根路径', async () => {
  const middlewareModule = await import('./middleware');
  const middleware = middlewareModule.middleware;

  const response = await middleware(new NextRequest('https://example.com/en'));

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('location'), null);
  assert.equal(response.headers.get('x-middleware-next'), '1');
  assertSecurityHeaders(response);
});

test('middleware matcher 不处理静态资源路径', async () => {
  const middlewareModule = await import('./middleware');

  const matcher = middlewareModule.config.matcher[0];
  const pattern = new RegExp(`^${matcher}$`);

  assert.equal(pattern.test('/pricing'), true);
  assert.equal(pattern.test('/api/storage/upload-image'), true);
  assert.equal(pattern.test('/_next/static/chunk.js'), false);
  assert.equal(pattern.test('/logo.png'), false);
});
