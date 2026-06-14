import assert from 'node:assert/strict';
import test from 'node:test';

import { withApi } from '@/shared/lib/api/route';

import { createUserSelfDetailsPostAction } from './self-details-action';

test('user self details action returns current subscription product id with no-store response', async () => {
  const handler = withApi(
    createUserSelfDetailsPostAction({
      createApiContext: () => ({
        requireUser: async () => ({ id: 'user_1' }),
      }),
      hasPermission: async (userId, permission) => {
        assert.equal(userId, 'user_1');
        assert.equal(permission, 'admin.access');
        return false;
      },
      getRemainingCreditsSummary: async (userId) => {
        assert.equal(userId, 'user_1');
        return {
          remainingCredits: 12,
          expiresAt: '2026-12-31T00:00:00.000Z',
        };
      },
      getCurrentSubscription: async (userId) => {
        assert.equal(userId, 'user_1');
        return {
          productId: 'pro-monthly',
        };
      },
    })
  );

  const response = await handler(
    new Request('https://example.com/api/user/self-details', {
      method: 'POST',
    })
  );
  const body = (await response.json()) as {
    data: {
      isAdmin: boolean;
      credits: { remainingCredits: number; expiresAt: string };
      currentSubscriptionProductId: string | null;
    };
  };

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(body.data, {
    isAdmin: false,
    credits: {
      remainingCredits: 12,
      expiresAt: '2026-12-31T00:00:00.000Z',
    },
    currentSubscriptionProductId: 'pro-monthly',
  });
});
