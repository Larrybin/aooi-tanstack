import assert from 'node:assert/strict';
import test from 'node:test';

import {
  signAiNotifyCallback,
  verifyAiNotifyCallbackSignature,
} from './notify-signature';

test('ai notify signature verifies matching payload', async () => {
  const signature = await signAiNotifyCallback({
    provider: 'replicate',
    taskId: 'task_1',
    secret: 'secret_1',
  });

  assert.equal(
    await verifyAiNotifyCallbackSignature({
      provider: 'replicate',
      taskId: 'task_1',
      signature,
      secret: 'secret_1',
    }),
    true
  );
});

test('ai notify signature rejects mismatched payload', async () => {
  const signature = await signAiNotifyCallback({
    provider: 'replicate',
    taskId: 'task_1',
    secret: 'secret_1',
  });

  assert.equal(
    await verifyAiNotifyCallbackSignature({
      provider: 'kie',
      taskId: 'task_1',
      signature,
      secret: 'secret_1',
    }),
    false
  );
});
