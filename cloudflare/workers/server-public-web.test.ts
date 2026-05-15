import assert from 'node:assert/strict';
import test from 'node:test';

import serverPublicWebWorker from './server-public-web';

test('scheduled cleanup fails when REMOVER_CLEANUP_SECRET is missing', async () => {
  await assert.rejects(
    () =>
      serverPublicWebWorker.scheduled(
        {},
        {
          NEXT_PUBLIC_APP_URL: 'https://ai-remover.example.com',
        },
        {} as ExecutionContext
      ),
    /REMOVER_CLEANUP_SECRET is not configured/
  );
});
