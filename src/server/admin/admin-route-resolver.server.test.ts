import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveAdminRouteData } from './admin-route-resolver';

type AdminRouteDeps = NonNullable<Parameters<typeof resolveAdminRouteData>[1]>;

function buildDeps(overrides: Partial<AdminRouteDeps> = {}): AdminRouteDeps {
  return {
    getCurrentRequest: () => new Request('https://example.test/admin'),
    readSignedInUser: async () => ({ id: 'admin_user' }),
    hasAdminAccess: async () => true,
    listUsers: async () => [],
    countUsers: async () => 0,
    listPayments: async () => ({ rows: [], total: 0 }),
    listAiTasks: async () => ({ rows: [], total: 0 }),
    listRoles: async () => [],
    listRolesIncludingDeleted: async () => [],
    listPermissions: async () => [],
    ...overrides,
  } as AdminRouteDeps;
}

test('resolveAdminRouteData renders migrated admin table sections instead of placeholders', async () => {
  const cases = [
    {
      splat: 'payments',
      title: 'Admin Payments',
      deps: buildDeps({
        listPayments: async () => ({
          rows: [
            {
              orderNo: 'order_1',
              user: { email: 'buyer@example.com' },
              status: 'paid',
              paymentType: 'one-time',
              paymentProvider: 'stripe',
              amount: 1000,
              currency: 'USD',
              createdAt: new Date('2026-01-01T00:00:00.000Z'),
            },
          ],
          total: 1,
        }),
      }),
    },
    {
      splat: 'roles',
      title: 'Admin Roles',
      deps: buildDeps({
        listRoles: async () => [
          {
            name: 'admin',
            title: 'Admin',
            status: 'active',
            createdAt: new Date('2026-01-01T00:00:00.000Z'),
          },
        ],
      }),
    },
    {
      splat: 'permissions',
      title: 'Admin Permissions',
      deps: buildDeps({
        listPermissions: async () => [
          {
            code: 'admin.users.read',
            title: 'Read users',
            resource: 'users',
            action: 'read',
            createdAt: new Date('2026-01-01T00:00:00.000Z'),
          },
        ],
      }),
    },
    {
      splat: 'ai-tasks',
      title: 'Admin AI Tasks',
      deps: buildDeps({
        listAiTasks: async () => ({
          rows: [
            {
              id: 'task_1',
              user: { email: 'creator@example.com' },
              mediaType: 'image',
              provider: 'openai',
              status: 'succeeded',
              createdAt: new Date('2026-01-01T00:00:00.000Z'),
            },
          ],
          total: 1,
        }),
      }),
    },
  ];

  for (const entry of cases) {
    const data = await resolveAdminRouteData(
      { locale: 'en', splat: entry.splat },
      entry.deps
    );

    assert.equal(data.status, 'ok');
    assert.equal(data.title, entry.title);
    assert.equal(data.page.kind, 'table');
    assert.equal(data.page.total, 1);
    assert.notEqual(data.page.rows[0], undefined);
  }
});

test('resolveAdminRouteData passes payment filters to the admin payments query', async () => {
  let captured: Parameters<AdminRouteDeps['listPayments']>[0] | undefined;

  await resolveAdminRouteData(
    {
      locale: 'en',
      splat: 'payments',
      search:
        '?type=one-time&status=paid&provider=stripe&orderNo=order_1&page=2&pageSize=10',
    },
    buildDeps({
      listPayments: async (input) => {
        captured = input;
        return { rows: [], total: 0 };
      },
    })
  );

  assert.deepEqual(captured, {
    page: 2,
    limit: 10,
    orderNo: 'order_1',
    paymentType: 'one-time',
    paymentProvider: 'stripe',
    status: 'paid',
  });
});
