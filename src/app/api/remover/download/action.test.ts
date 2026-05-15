import assert from 'node:assert/strict';
import test from 'node:test';

import { NotFoundError } from '@/shared/lib/api/errors';

import { createRemoverDownloadPostAction } from './action';

test('high-res download does not reserve or commit quota when storage object is missing', async () => {
  let reserved = false;
  let committed = false;
  const action = createRemoverDownloadPostAction(
    {
      createApiContext: () =>
        ({
          parseJson: async () => ({ jobId: 'job_1' }),
        }) as never,
      resolveActor: async () =>
        ({
          kind: 'user',
          userId: 'user_1',
        }) as never,
      resolveDownload: async () =>
        ({
          job: { id: 'job_1' },
          storageKey: 'output.png',
          filename: 'ai-remover-job_1-high-res.png',
          requiresHighResQuota: true,
        }) as never,
      reserveHighResQuota: async () => {
        reserved = true;
        return 'reservation_1';
      },
      getStorageService: async () =>
        ({
          getFile: async () => null,
        }) as never,
      downloadDeps: {
        commitReservation: async () => {
          committed = true;
        },
      } as never,
    },
    'high_res'
  );

  await assert.rejects(
    action(
      new Request('https://example.com/api/remover/download/high-res', {
        method: 'POST',
      })
    ),
    NotFoundError
  );
  assert.equal(committed, false);
  assert.equal(reserved, false);
});

test('high-res download commits quota after storage object is available', async () => {
  let reserved = false;
  let committedReservationId = '';
  const action = createRemoverDownloadPostAction(
    {
      createApiContext: () =>
        ({
          parseJson: async () => ({ jobId: 'job_1' }),
        }) as never,
      resolveActor: async () =>
        ({
          kind: 'user',
          userId: 'user_1',
        }) as never,
      resolveDownload: async () =>
        ({
          job: { id: 'job_1' },
          storageKey: 'output.png',
          filename: 'ai-remover-job_1-high-res.png',
          requiresHighResQuota: true,
        }) as never,
      reserveHighResQuota: async () => {
        reserved = true;
        return 'reservation_1';
      },
      getStorageService: async () =>
        ({
          getFile: async () => ({
            body: new ReadableStream<Uint8Array>({
              start(controller) {
                controller.enqueue(new Uint8Array([1, 2, 3]));
                controller.close();
              },
            }),
            contentType: 'image/png',
            contentLength: 3,
          }),
        }) as never,
      downloadDeps: {
        commitReservation: async ({ reservationId }) => {
          committedReservationId = reservationId;
        },
      } as never,
    },
    'high_res'
  );

  const response = await action(
    new Request('https://example.com/api/remover/download/high-res', {
      method: 'POST',
    })
  );

  assert.equal(response.status, 200);
  assert.equal(reserved, true);
  assert.equal(committedReservationId, 'reservation_1');
});
