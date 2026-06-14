import assert from 'node:assert/strict';
import test from 'node:test';

import { handleAuthApiRequest } from './auth-action';

test('handleAuthApiRequest forwards standard requests and disables cache', async () => {
  let handledUrl = '';
  let handledBody = '';
  const response = await handleAuthApiRequest(
    new Request('https://example.test/api/auth/sign-in/email', {
      method: 'POST',
      body: 'email=ada%40example.test',
    }),
    {
      getAuth: async () => ({
        handler: async (request) => {
          handledUrl = request.url;
          handledBody = await request.text();
          return new Response('ok');
        },
      }),
    }
  );

  assert.equal(handledUrl, 'https://example.test/api/auth/sign-in/email');
  assert.equal(handledBody, 'email=ada%40example.test');
  assert.equal(response.headers.get('cache-control'), 'no-store');
});

test('handleAuthApiRequest rewrites local auth-spike redirects', async () => {
  const response = await handleAuthApiRequest(
    new Request('http://localhost:8787/api/auth/callback/google?code=1'),
    {
      isAuthSpikeOAuthUpstreamMockEnabled: () => true,
      getAuthOriginDebug: () =>
        ({
          runtimeBaseUrl: 'http://localhost:8787',
        }) as never,
      getRuntimeEnvString: () => undefined,
      getAuth: async () => ({
        handler: async () =>
          new Response(null, {
            status: 302,
            headers: {
              Location:
                'https://example.test/api/auth/callback/google?code=1',
            },
          }),
      }),
    }
  );

  assert.equal(
    response.headers.get('location'),
    '/api/auth/callback/google?code=1'
  );
  assert.equal(response.headers.get('cache-control'), 'no-store');
});
