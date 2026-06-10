import assert from 'node:assert/strict';
import test from 'node:test';

import { withApi } from '@/shared/lib/api/route';

import { createUserCreditsPostAction } from './action';

test('user credits action reads authenticated user credits with no-store response', async () => {
  let requiredUser = false;
  let requestedUserId = '';

  const handler = withApi(
    createUserCreditsPostAction({
      createApiContext: () => ({
        requireUser: async () => {
          requiredUser = true;
          return { id: 'user_1' };
        },
      }),
      getRemainingCreditsSummary: async (userId) => {
        requestedUserId = userId;
        return {
          remainingCredits: 42,
          expiresAt: '2026-12-31T00:00:00.000Z',
        };
      },
    })
  );

  const response = await handler(
    new Request('https://example.com/api/user/get-user-credits', {
      method: 'POST',
    })
  );
  const body = (await response.json()) as {
    data: {
      remainingCredits: number;
      expiresAt: string;
    };
  };

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(requiredUser, true);
  assert.equal(requestedUserId, 'user_1');
  assert.deepEqual(body.data, {
    remainingCredits: 42,
    expiresAt: '2026-12-31T00:00:00.000Z',
  });
});
