import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createServerWorker,
  shouldPrintServerWorkerAuthDebug,
} from '../cloudflare/workers/create-server-worker';
import { getRuntimeEnvString } from '../src/infra/runtime/env.server';

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

test('createServerWorker 在 native default.fetch 内暴露 Cloudflare bindings', async () => {
  const previousAppUrl = process.env.NEXT_PUBLIC_APP_URL;
  delete process.env.NEXT_PUBLIC_APP_URL;

  try {
    const worker = createServerWorker(async () => ({
      default: {
        fetch() {
          return new Response(
            getRuntimeEnvString('NEXT_PUBLIC_APP_URL') || 'missing'
          );
        },
      },
    }));
    const response = await worker.fetch(
      new Request('https://example.test/native'),
      {
        NEXT_PUBLIC_APP_URL: 'https://binding.example.test',
      },
      {} as ExecutionContext
    );

    assert.equal(await response.text(), 'https://binding.example.test');
    assert.equal(process.env.NEXT_PUBLIC_APP_URL, undefined);
  } finally {
    if (previousAppUrl === undefined) {
      delete process.env.NEXT_PUBLIC_APP_URL;
    } else {
      process.env.NEXT_PUBLIC_APP_URL = previousAppUrl;
    }
  }
});
