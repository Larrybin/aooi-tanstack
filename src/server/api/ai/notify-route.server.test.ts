import assert from 'node:assert/strict';
import test from 'node:test';

import { withApi } from '@/shared/lib/api/route';
import { readRequestBodyByteCountUpTo } from '@/shared/lib/runtime/request-body';

import { createAiNotifyPostAction } from './notify-route';
import {
  signAiNotifyCallback,
  verifyAiNotifyCallbackSignature,
} from './notify-signature';

function createHandler(secret: string | undefined) {
  const infos: unknown[] = [];
  const warnings: unknown[] = [];
  const action = createAiNotifyPostAction({
    getLog: () => ({
      info: (_message, meta) => infos.push(meta),
      warn: (_message, meta) => warnings.push(meta),
    }),
    getAiNotifyWebhookSecret: () => secret || '',
    verifyAiNotifyCallbackSignature,
    readRequestBodyByteCountUpTo,
  });

  return {
    infos,
    warnings,
    POST: withApi((request: Request) =>
      action(request, { provider: 'replicate' })
    ),
  };
}

test('ai notify accepts valid signatures and logs ack metadata', async () => {
  const signature = await signAiNotifyCallback({
    provider: 'replicate',
    taskId: 'task_1',
    secret: 'secret_1',
  });
  const { POST, infos } = createHandler('secret_1');

  const response = await POST(
    new Request(
      `http://localhost/api/ai/notify/replicate?task_id=task_1&sig=${signature}`,
      {
        method: 'POST',
        body: '{}',
      }
    )
  );

  assert.equal(response.status, 200);
  assert.equal(infos.length, 1);
});

test('ai notify rejects invalid signatures', async () => {
  const { POST } = createHandler('secret_1');
  const response = await POST(
    new Request(
      'http://localhost/api/ai/notify/replicate?task_id=task_1&sig=bad',
      {
        method: 'POST',
        body: '{}',
      }
    )
  );

  assert.equal(response.status, 403);
});

test('ai notify rejects when webhook secret is missing', async () => {
  const { POST } = createHandler(undefined);
  const response = await POST(
    new Request(
      'http://localhost/api/ai/notify/replicate?task_id=task_1&sig=bad',
      {
        method: 'POST',
        body: '{}',
      }
    )
  );

  assert.equal(response.status, 503);
});
