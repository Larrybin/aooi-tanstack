import assert from 'node:assert/strict';
import test from 'node:test';

import { createRemoverCleanupPostHandler } from './cleanup-route';

test('remover cleanup returns 404 when cleanup secret is missing', async () => {
  const handler = createRemoverCleanupPostHandler({
    requireSite: () => undefined,
    getCleanupSecret: () => '',
    cleanupExpiredImages: async () => ({ deletedJobs: 0, deletedAssets: 0 }),
  });

  const response = await handler(
    new Request('http://localhost/api/remover/cleanup', { method: 'POST' })
  );

  assert.equal(response.status, 404);
});

test('remover cleanup returns 403 for invalid cleanup secret', async () => {
  const handler = createRemoverCleanupPostHandler({
    requireSite: () => undefined,
    getCleanupSecret: () => 'secret',
    cleanupExpiredImages: async () => ({ deletedJobs: 0, deletedAssets: 0 }),
  });

  const response = await handler(
    new Request('http://localhost/api/remover/cleanup', {
      method: 'POST',
      headers: { authorization: 'Bearer wrong' },
    })
  );

  assert.equal(response.status, 403);
});

test('remover cleanup runs cleanup with valid secret', async () => {
  let cleanupCalls = 0;
  const handler = createRemoverCleanupPostHandler({
    requireSite: () => undefined,
    getCleanupSecret: () => 'secret',
    cleanupExpiredImages: async () => {
      cleanupCalls += 1;
      return { deletedJobs: 1, deletedAssets: 2 };
    },
  });

  const response = await handler(
    new Request('http://localhost/api/remover/cleanup', {
      method: 'POST',
      headers: { authorization: 'Bearer secret' },
    })
  );
  const body = (await response.json()) as {
    data: { deletedJobs: number; deletedAssets: number };
  };

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(cleanupCalls, 1);
  assert.deepEqual(body.data, { deletedJobs: 1, deletedAssets: 2 });
});
