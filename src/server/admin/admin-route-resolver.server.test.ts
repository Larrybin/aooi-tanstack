import assert from 'node:assert/strict';
import test from 'node:test';

import {
  resolveAdminRouteData,
  resolveAdminSettingsUpdate,
} from './admin-route-resolver';

type AdminRouteDeps = NonNullable<Parameters<typeof resolveAdminRouteData>[1]>;
type AdminSettingsUpdateDeps = NonNullable<
  Parameters<typeof resolveAdminSettingsUpdate>[1]
>;

function buildDeps(overrides: Partial<AdminRouteDeps> = {}): AdminRouteDeps {
  return {
    getCurrentRequest: () => new Request('https://example.test/admin'),
    readSignedInUser: async () => ({ id: 'admin_user' }),
    hasAdminAccess: async () => true,
    hasAllPermissions: async () => true,
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

function buildSettingsUpdateDeps(
  overrides: Partial<AdminSettingsUpdateDeps> = {}
): AdminSettingsUpdateDeps {
  return {
    getCurrentRequest: () =>
      new Request('https://example.test/admin/settings/auth'),
    readSignedInUser: async () => ({ id: 'admin_user' }),
    hasAdminAccess: async () => true,
    hasAllPermissions: async () => true,
    readSettings: async () => ({ configs: {} }),
    saveSettings: async () => [],
    ...overrides,
  } as AdminSettingsUpdateDeps;
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

test('resolveAdminRouteData reads TanStack search object values for users', async () => {
  let listInput: Parameters<AdminRouteDeps['listUsers']>[0] | undefined;
  let countInput: Parameters<AdminRouteDeps['countUsers']>[0] | undefined;

  await resolveAdminRouteData(
    {
      locale: 'en',
      splat: 'users',
      search: { page: 2, limit: 10, email: 'buyer@example.com' },
    },
    buildDeps({
      listUsers: async (input) => {
        listInput = input;
        return [];
      },
      countUsers: async (input) => {
        countInput = input;
        return 0;
      },
    })
  );

  assert.deepEqual(listInput, {
    page: 2,
    limit: 10,
    email: 'buyer@example.com',
  });
  assert.deepEqual(countInput, { email: 'buyer@example.com' });
});

test('resolveAdminRouteData reads URLSearchParams values for payments', async () => {
  let captured: Parameters<AdminRouteDeps['listPayments']>[0] | undefined;

  await resolveAdminRouteData(
    {
      locale: 'en',
      splat: 'payments',
      search: new URLSearchParams('page=3&pageSize=20&status=paid'),
    },
    buildDeps({
      listPayments: async (input) => {
        captured = input;
        return { rows: [], total: 0 };
      },
    })
  );

  assert.deepEqual(captured, {
    page: 3,
    limit: 20,
    orderNo: undefined,
    paymentType: undefined,
    paymentProvider: undefined,
    status: 'paid',
  });
});

test('resolveAdminRouteData localizes admin settings tabs from the route locale', async () => {
  const data = await resolveAdminRouteData(
    { locale: 'zh', splat: 'settings/auth' },
    buildDeps()
  );

  assert.equal(data.status, 'ok');
  assert.equal(data.page.kind, 'settings');
  assert.equal(data.page.tabs.find((tab) => tab.active)?.title, '认证');
  assert.equal(
    data.page.tabs.find((tab) => tab.active)?.href,
    '/zh/admin/settings/auth'
  );
});

test('resolveAdminRouteData rejects unsupported localized admin locale segments', async () => {
  const data = await resolveAdminRouteData(
    { locale: 'foo', splat: 'users' },
    buildDeps()
  );

  assert.deepEqual(data, { status: 'not_found' });
});

test('resolveAdminRouteData rejects unknown admin settings tabs', async () => {
  const data = await resolveAdminRouteData(
    { locale: 'en', splat: 'settings/not-a-tab' },
    buildDeps()
  );

  assert.deepEqual(data, { status: 'not_found' });
});

test('resolveAdminRouteData checks section permissions before loading native admin rows', async () => {
  const cases: Array<{ splat: string; codes: string[] }> = [
    {
      splat: 'settings/auth',
      codes: ['admin.settings.read', 'admin.settings.write'],
    },
    { splat: 'users', codes: ['admin.users.read'] },
    { splat: 'payments', codes: ['admin.payments.read'] },
    { splat: 'roles', codes: ['admin.roles.read'] },
    { splat: 'permissions', codes: ['admin.permissions.read'] },
    { splat: 'ai-tasks', codes: ['admin.ai-tasks.read'] },
  ];

  for (const entry of cases) {
    let capturedCodes: string[] = [];
    const data = await resolveAdminRouteData(
      { locale: 'en', splat: entry.splat },
      buildDeps({
        hasAllPermissions: async (_userId, codes) => {
          capturedCodes = codes;
          return false;
        },
        listUsers: async () => {
          throw new Error('listUsers should not be called');
        },
        countUsers: async () => {
          throw new Error('countUsers should not be called');
        },
        listPayments: async () => {
          throw new Error('listPayments should not be called');
        },
        listRoles: async () => {
          throw new Error('listRoles should not be called');
        },
        listRolesIncludingDeleted: async () => {
          throw new Error('listRolesIncludingDeleted should not be called');
        },
        listPermissions: async () => {
          throw new Error('listPermissions should not be called');
        },
        listAiTasks: async () => {
          throw new Error('listAiTasks should not be called');
        },
      })
    );

    assert.equal(data.status, 'forbidden');
    assert.deepEqual(capturedCodes, entry.codes);
  }
});

test('resolveAdminRouteData returns editable settings forms without server handlers', async () => {
  const data = await resolveAdminRouteData(
    { locale: 'en', splat: 'settings/auth' },
    buildDeps()
  );

  assert.equal(data.status, 'ok');
  assert.equal(data.page.kind, 'settings');
  assert.ok(data.page.forms.length > 0);
  assert.ok(
    data.page.forms.some((form) => form.submit?.button?.title === 'Save')
  );
  assert.equal('handler' in (data.page.forms[0]?.submit ?? {}), false);
});

test('resolveAdminSettingsUpdate requires settings write permissions', async () => {
  let saved = false;
  const result = await resolveAdminSettingsUpdate(
    { locale: 'en', values: { google_auth_enabled: 'true' } },
    buildSettingsUpdateDeps({
      hasAllPermissions: async () => false,
      saveSettings: async () => {
        saved = true;
        return [];
      },
    })
  );

  assert.equal(result.status, 'error');
  assert.equal(result.message, 'Settings permission required');
  assert.equal(saved, false);
});

test('resolveAdminSettingsUpdate normalizes and saves registered settings', async () => {
  let savedConfigs: Record<string, string> | undefined;

  const result = await resolveAdminSettingsUpdate(
    { locale: 'en', values: { google_auth_enabled: 'true' } },
    buildSettingsUpdateDeps({
      readSettings: async () => ({
        configs: { google_auth_enabled: 'false', unrelated: 'kept' },
      }),
      saveSettings: async (configs) => {
        savedConfigs = configs;
        return [];
      },
    })
  );

  assert.equal(result.status, 'success');
  assert.equal(result.message, 'Settings updated');
  assert.equal(savedConfigs?.google_auth_enabled, 'true');
  assert.equal(savedConfigs?.unrelated, 'kept');
});
