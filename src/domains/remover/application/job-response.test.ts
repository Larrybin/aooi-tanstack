import assert from 'node:assert/strict';
import test from 'node:test';

import type { RemoverActor } from '../domain/types';
import type { RemoverJob } from '../infra/job';
import { serializeRemoverJobForClient } from './job-response';

const userActor = {
  kind: 'user',
  userId: 'user_1',
} satisfies RemoverActor;

const job = {
  id: 'job_1',
  userId: 'user_1',
  anonymousSessionId: null,
  provider: 'cloudflare-workers-ai',
  model: '@cf/model',
  providerTaskId: 'task_1',
  status: 'succeeded',
  inputImageAssetId: 'input_asset',
  maskImageAssetId: 'mask_asset',
  inputImageKey: 'input.png',
  maskImageKey: 'mask.png',
  outputImageKey: 'output.png',
  thumbnailKey: 'thumbnail.webp',
  costUnits: 1,
  quotaReservationId: 'reservation_1',
  errorCode: null,
  errorMessage: null,
  createdAt: new Date('2026-05-06T00:00:00Z'),
  updatedAt: new Date('2026-05-06T00:00:00Z'),
  deletedAt: null,
  expiresAt: new Date('2026-05-07T00:00:00Z'),
} satisfies RemoverJob;

test('serializeRemoverJobForClient does not expose storage keys or high-res URLs', () => {
  const result = serializeRemoverJobForClient({
    actor: userActor,
    job,
  });
  const serialized = result as Record<string, unknown>;

  assert.equal(serialized.outputImageUrl, undefined);
  assert.equal(serialized.outputImageKey, undefined);
  assert.equal(serialized.thumbnailKey, undefined);
  assert.equal(serialized.inputImageKey, undefined);
  assert.equal(serialized.maskImageKey, undefined);
  assert.equal(serialized.provider, undefined);
  assert.equal(serialized.model, undefined);
  assert.equal(serialized.providerTaskId, undefined);
  assert.equal(result.lowResDownloadAvailable, true);
  assert.equal(result.highResDownloadRequiresSignIn, false);
});
