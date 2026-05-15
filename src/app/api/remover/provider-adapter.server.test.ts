import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveRemoverProviderAdapter } from './provider-adapter.server';

function withRemoverProviderEnv(
  env: {
    provider?: string;
    model?: string;
  },
  fn: () => Promise<void>
) {
  const previousProvider = process.env.REMOVER_AI_PROVIDER;
  const previousModel = process.env.REMOVER_AI_MODEL;
  if (env.provider === undefined) {
    delete process.env.REMOVER_AI_PROVIDER;
  } else {
    process.env.REMOVER_AI_PROVIDER = env.provider;
  }
  if (env.model === undefined) {
    delete process.env.REMOVER_AI_MODEL;
  } else {
    process.env.REMOVER_AI_MODEL = env.model;
  }

  return fn().finally(() => {
    if (previousProvider === undefined) {
      delete process.env.REMOVER_AI_PROVIDER;
    } else {
      process.env.REMOVER_AI_PROVIDER = previousProvider;
    }
    if (previousModel === undefined) {
      delete process.env.REMOVER_AI_MODEL;
    } else {
      process.env.REMOVER_AI_MODEL = previousModel;
    }
  });
}

test('resolveRemoverProviderAdapter defaults to Cloudflare Workers AI', async () => {
  await withRemoverProviderEnv({}, async () => {
    await assert.rejects(
      () => resolveRemoverProviderAdapter(),
      /Cloudflare Workers AI is not bound/
    );
  });
});

test('resolveRemoverProviderAdapter requires model for explicit non-Cloudflare provider', async () => {
  await withRemoverProviderEnv({ provider: 'replicate' }, async () => {
    await assert.rejects(
      () => resolveRemoverProviderAdapter(),
      /REMOVER_AI_MODEL is not configured/
    );
  });
});
