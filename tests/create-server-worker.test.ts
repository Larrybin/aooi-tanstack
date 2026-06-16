import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createServerWorker,
  shouldPrintServerWorkerAuthDebug,
} from '../cloudflare/workers/create-server-worker';

test('shouldPrintServerWorkerAuthDebug 在 binding-only auth debug 场景下返回 true', () => {
  const previousDebugFlag = process.env.CF_LOCAL_AUTH_DEBUG;
  delete process.env.CF_LOCAL_AUTH_DEBUG;

  try {
    const shouldPrint = shouldPrintServerWorkerAuthDebug(
      new Request('https://example.com/api/auth/session'),
      {
        bindings: {
          CF_LOCAL_AUTH_DEBUG: 'true',
        },
      }
    );

    assert.equal(shouldPrint, true);
  } finally {
    if (previousDebugFlag === undefined) {
      delete process.env.CF_LOCAL_AUTH_DEBUG;
    } else {
      process.env.CF_LOCAL_AUTH_DEBUG = previousDebugFlag;
    }
  }
});

test('createServerWorker 调用 native module default.fetch 且不写入 process.env', async () => {
  const previousSecret = process.env.BETTER_AUTH_SECRET;
  delete process.env.BETTER_AUTH_SECRET;

  try {
    const worker = createServerWorker(async () => ({
      default: {
        fetch(request: Request) {
          return new Response(new URL(request.url).pathname);
        },
      },
    }));
    const response = await worker.fetch(
      new Request('https://example.test/native'),
      {
        BETTER_AUTH_SECRET: 'binding-secret',
      },
      {} as ExecutionContext
    );

    assert.equal(response.status, 200);
    assert.equal(await response.text(), '/native');
    assert.equal(process.env.BETTER_AUTH_SECRET, undefined);
    assert.equal(process.env.NON_STRING_BINDING, undefined);
  } finally {
    if (previousSecret === undefined) {
      delete process.env.BETTER_AUTH_SECRET;
    } else {
      process.env.BETTER_AUTH_SECRET = previousSecret;
    }
  }
});
