import assert from 'node:assert/strict';
import test from 'node:test';

import {
  compareRuntimeResponseContracts,
  RUNTIME_PARITY_IGNORED_HEADERS,
  type RuntimeParityResponseSummary,
} from '../../src/testing/runtime-parity';

function responseSummary(
  overrides: Partial<RuntimeParityResponseSummary> = {}
): RuntimeParityResponseSummary {
  return {
    status: 200,
    cacheControl: 'no-store',
    contentType: 'application/json; charset=utf-8',
    location: 'https://example.com/settings/profile?from=auth',
    headers: {
      'cache-control': 'no-store',
      'content-type': 'application/json; charset=utf-8',
      location: 'https://example.com/settings/profile?from=auth',
      'x-shared-contract': 'stable',
    },
    setCookieHeaderCount: 1,
    cookies: [
      {
        name: 'session',
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        clearsCookie: false,
      },
    ],
    setCookiePresent: true,
    clearsCookie: false,
    ...overrides,
  };
}

test('runtime parity whitelist 固定为传输层与平台注入头', () => {
  assert.deepEqual(RUNTIME_PARITY_IGNORED_HEADERS, [
    'connection',
    'keep-alive',
    'content-encoding',
    'date',
    'x-request-id',
    'x-vercel-id',
    'cf-ray',
  ]);
});

test('compareRuntimeResponseContracts 忽略 whitelist 头差异', () => {
  const result = compareRuntimeResponseContracts({
    label: 'sign-in auth response',
    baselineName: 'vercel',
    candidateName: 'cloudflare',
    baselineResponses: [
      responseSummary({
        headers: {
          'cache-control': 'no-store',
          'content-type': 'application/json; charset=utf-8',
          location: 'https://vercel.example.com/settings/profile?from=auth',
          connection: 'keep-alive',
          'keep-alive': 'timeout=5',
          date: 'Mon, 07 Apr 2026 10:00:00 GMT',
          'x-request-id': 'req-vercel',
          'x-vercel-id': 'iad1::abc',
          'x-shared-contract': 'stable',
        },
      }),
    ],
    candidateResponses: [
      responseSummary({
        contentType: 'application/json',
        location: 'https://cloudflare.example.com/settings/profile?from=auth',
        headers: {
          'cache-control': 'no-store',
          'content-type': 'application/json',
          location: 'https://cloudflare.example.com/settings/profile?from=auth',
          'content-encoding': 'identity',
          date: 'Mon, 07 Apr 2026 10:00:09 GMT',
          'x-request-id': 'req-cloudflare',
          'cf-ray': 'ray-123',
          'x-shared-contract': 'stable',
        },
      }),
    ],
  });

  assert.equal(result.status, 'passed');
});

test('compareRuntimeResponseContracts 对非白名单头差异失败', () => {
  const result = compareRuntimeResponseContracts({
    label: 'sign-in auth response',
    baselineName: 'vercel',
    candidateName: 'cloudflare',
    baselineResponses: [responseSummary()],
    candidateResponses: [
      responseSummary({
        headers: {
          'cache-control': 'no-store',
          'content-type': 'application/json; charset=utf-8',
          location: 'https://example.com/settings/profile?from=auth',
          'x-shared-contract': 'drifted',
        },
      }),
    ],
  });

  assert.equal(result.status, 'failed');
  assert.match(result.detail, /x-shared-contract/);
});
