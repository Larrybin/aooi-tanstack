import assert from 'node:assert/strict';
import test from 'node:test';

import type { RemoverJob } from '../infra/job';
import { deleteRemoverJobImagesForUser } from './delete-image';

const job = {
  id: 'job_1',
  userId: 'user_1',
  anonymousSessionId: null,
  inputImageKey: 'input.png',
  maskImageKey: 'mask.png',
  outputImageKey: 'output.png',
  thumbnailKey: 'thumbnail.webp',
} as RemoverJob;

test('deleteRemoverJobImagesForUser deletes storage before marking database rows deleted', async () => {
  const events: string[] = [];

  const deleted = await deleteRemoverJobImagesForUser({
    jobId: 'job_1',
    userId: 'user_1',
    deps: {
      findJobById: async () => job,
      getStorageService: async () => ({
        deleteFiles: async (keys) => {
          events.push(`storage:${keys.join(',')}`);
        },
      }),
      markJobDeleted: async () => {
        events.push('job');
        return job;
      },
      markAssetsDeleted: async () => {
        events.push('assets');
      },
    },
  });

  assert.equal(deleted, true);
  assert.deepEqual(events, [
    'storage:input.png,mask.png,output.png,thumbnail.webp',
    'job',
    'assets',
  ]);
});

test('deleteRemoverJobImagesForUser keeps database unchanged when storage delete fails', async () => {
  let markedJob = false;
  let markedAssets = false;

  await assert.rejects(
    () =>
      deleteRemoverJobImagesForUser({
        jobId: 'job_1',
        userId: 'user_1',
        deps: {
          findJobById: async () => job,
          getStorageService: async () => ({
            deleteFiles: async () => {
              throw new Error('storage failed');
            },
          }),
          markJobDeleted: async () => {
            markedJob = true;
            return job;
          },
          markAssetsDeleted: async () => {
            markedAssets = true;
          },
        },
      }),
    /storage failed/
  );

  assert.equal(markedJob, false);
  assert.equal(markedAssets, false);
});
