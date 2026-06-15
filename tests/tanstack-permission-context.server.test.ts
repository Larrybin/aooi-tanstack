import assert from 'node:assert/strict';
import test from 'node:test';

import { ForbiddenError } from '@/shared/lib/api/errors';

import { createTanStackPermissionHelper } from '../apps/web/src/server/permission-context';

test('requireTanStackPermission allows matching permission', async () => {
  const requirePermission = createTanStackPermissionHelper({
    checkUserPermission: async (userId, code) =>
      userId === 'user_1' && code === 'settings.write',
  });

  await requirePermission('user_1', 'settings.write');
});

test('requireTanStackPermission rejects missing permission', async () => {
  const requirePermission = createTanStackPermissionHelper({
    checkUserPermission: async () => false,
  });

  await assert.rejects(
    () => requirePermission('user_1', 'settings.write'),
    ForbiddenError
  );
});
