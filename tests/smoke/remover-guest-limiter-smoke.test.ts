import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { runRemoverGuestLimiterSmokeAgainstBaseUrl } from '../../scripts/run-remover-guest-limiter-smoke.mjs';
import {
  REMOVER_GUEST_JOB_LIMIT_CONFIG,
  REMOVER_GUEST_UPLOAD_LIMIT_CONFIG,
} from '../../src/shared/lib/api/limiters-config';

function jsonResponse(body: unknown, status = 200, headers?: HeadersInit) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  });
}

test('runRemoverGuestLimiterSmokeAgainstBaseUrl verifies upload and job guest limiters', async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  let uploadCount = 0;
  let jobCount = 0;

  async function fetchImpl(input: string | URL | Request, init?: RequestInit) {
    const url = String(input);
    calls.push({ url, init });

    if (url.endsWith('/api/remover/upload')) {
      uploadCount += 1;
      if (uploadCount <= REMOVER_GUEST_UPLOAD_LIMIT_CONFIG.maxAttempts) {
        return jsonResponse(
          {
            code: 0,
            message: 'ok',
            data: {
              asset: {
                id: `asset_${uploadCount}`,
                kind: 'original',
              },
              anonymousSessionId: 'anon_test',
            },
          },
          200,
          {
            'Set-Cookie': 'remover_session=anon_test; Path=/; HttpOnly',
          }
        );
      }

      return jsonResponse(
        { code: 429, message: 'remover guest limit exceeded' },
        429
      );
    }

    if (url.endsWith('/api/remover/jobs')) {
      jobCount += 1;
      if (jobCount <= REMOVER_GUEST_JOB_LIMIT_CONFIG.maxAttempts) {
        return jsonResponse(
          { code: 404, message: 'remover image asset not found' },
          404
        );
      }

      return jsonResponse(
        { code: 429, message: 'remover guest limit exceeded' },
        429
      );
    }

    throw new Error(`unexpected request ${url}`);
  }

  const result = await runRemoverGuestLimiterSmokeAgainstBaseUrl({
    baseUrl: 'http://127.0.0.1:8787/',
    fetchImpl,
    clientIp: '198.51.100.77',
  });

  assert.deepEqual(result, {
    upload: {
      allowedAttempts: REMOVER_GUEST_UPLOAD_LIMIT_CONFIG.maxAttempts,
      blockedStatus: 429,
    },
    job: {
      allowedAttempts: REMOVER_GUEST_JOB_LIMIT_CONFIG.maxAttempts,
      blockedStatus: 429,
    },
  });

  const uploadCalls = calls.filter((call) =>
    call.url.endsWith('/api/remover/upload')
  );
  const jobCalls = calls.filter((call) =>
    call.url.endsWith('/api/remover/jobs')
  );

  assert.equal(
    uploadCalls.length,
    REMOVER_GUEST_UPLOAD_LIMIT_CONFIG.maxAttempts + 1
  );
  assert.equal(jobCalls.length, REMOVER_GUEST_JOB_LIMIT_CONFIG.maxAttempts + 1);
  assert.equal(
    (uploadCalls[0]?.init?.headers as Record<string, string>)?.[
      'CF-Connecting-IP'
    ],
    '198.51.100.77'
  );
  assert.match(
    String((uploadCalls[1]?.init?.headers as Record<string, string>)?.Cookie),
    /remover_session=anon_test/
  );
  assert.match(
    String((jobCalls[0]?.init?.body as string) || ''),
    /guest-limiter-missing-input/
  );
});

test('package exposes anonymous remover limiter smoke command', async () => {
  const packageJson = JSON.parse(await readFile('package.json', 'utf8'));

  assert.equal(
    packageJson.scripts['test:remover-guest-limiter-smoke'],
    'SITE=ai-remover pnpm cf:build -- --workers=router,public-web && SITE=ai-remover node scripts/run-with-site.mjs node --import tsx scripts/run-remover-guest-limiter-smoke.mjs'
  );
});
