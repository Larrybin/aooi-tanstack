import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildAiRemoverCloudflareDevExtraVars,
  runAiRemoverCloudflareDev,
} from '../../scripts/run-ai-remover-cloudflare-dev.mjs';

const model = '@cf/runwayml/stable-diffusion-v1-5-inpainting';

test('buildAiRemoverCloudflareDevExtraVars pins remover to Workers AI', () => {
  assert.deepEqual(
    buildAiRemoverCloudflareDevExtraVars({
      model,
    }),
    {
      REMOVER_AI_PROVIDER: 'cloudflare-workers-ai',
      REMOVER_AI_MODEL: model,
    }
  );
});

test('runAiRemoverCloudflareDev starts topology and stops it after shutdown signal', async () => {
  let stopped = false;
  const logs: string[] = [];
  const result = await runAiRemoverCloudflareDev({
    baseUrl: 'http://localhost:8787',
    databaseUrl: 'postgresql://example',
    authSecret: 'secret',
    logger: {
      log: (message: string) => logs.push(message),
    } as never,
    startCloudflareLocalDevTopologyImpl: async (options: unknown) => {
      const extraVars = (options as { extraVars: Record<string, string> })
        .extraVars;
      assert.equal(extraVars.REMOVER_AI_PROVIDER, 'cloudflare-workers-ai');
      assert.equal(extraVars.REMOVER_AI_MODEL, model);
      assert.equal(extraVars.AUTH_URL, undefined);
      assert.equal(extraVars.BETTER_AUTH_URL, undefined);
      return {
        getRouterBaseUrl: () => 'http://localhost:8787',
        stop: async () => {
          stopped = true;
        },
      };
    },
    waitUntilStopped: async () => 'SIGTERM',
  });

  assert.equal(result, 'SIGTERM');
  assert.equal(stopped, true);
  assert.match(logs.join('\n'), /Open http:\/\/localhost:8787/u);
});

test('runAiRemoverCloudflareDev falls back to the local auth secret', async () => {
  const previousAuthSecret = process.env.AUTH_SECRET;
  const previousBetterAuthSecret = process.env.BETTER_AUTH_SECRET;
  delete process.env.AUTH_SECRET;
  delete process.env.BETTER_AUTH_SECRET;

  try {
    let receivedAuthSecret = '';

    await runAiRemoverCloudflareDev({
      baseUrl: 'http://localhost:8787',
      databaseUrl: 'postgresql://example',
      logger: {
        log: () => {},
      } as never,
      startCloudflareLocalDevTopologyImpl: async (options: unknown) => {
        receivedAuthSecret = (options as { authSecret: string }).authSecret;
        return {
          getRouterBaseUrl: () => 'http://localhost:8787',
          stop: async () => {},
        };
      },
      waitUntilStopped: async () => 'SIGTERM',
    });

    assert.equal(
      receivedAuthSecret,
      'local-ai-remover-cloudflare-dev-0123456789'
    );
  } finally {
    if (previousAuthSecret === undefined) {
      delete process.env.AUTH_SECRET;
    } else {
      process.env.AUTH_SECRET = previousAuthSecret;
    }

    if (previousBetterAuthSecret === undefined) {
      delete process.env.BETTER_AUTH_SECRET;
    } else {
      process.env.BETTER_AUTH_SECRET = previousBetterAuthSecret;
    }
  }
});

test('runAiRemoverCloudflareDev requires a database url', async () => {
  await assert.rejects(
    runAiRemoverCloudflareDev({
      databaseUrl: '',
    }),
    /DATABASE_URL or AUTH_SPIKE_DATABASE_URL is required/u
  );
});
