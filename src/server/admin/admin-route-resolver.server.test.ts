import assert from 'node:assert/strict';
import test from 'node:test';

import {
  resolveAdminAction,
  resolveAdminRouteData,
  resolveAdminSettingsUpdate,
} from './admin-route-resolver';

type AdminRouteDeps = NonNullable<Parameters<typeof resolveAdminRouteData>[1]>;
type AdminActionDeps = NonNullable<Parameters<typeof resolveAdminAction>[1]>;
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
    listSubscriptions: async () => ({ rows: [], total: 0 }),
    listAiTasks: async () => ({ rows: [], total: 0 }),
    listApikeys: async () => ({ rows: [], total: 0 }),
    listChats: async () => ({ rows: [], total: 0 }),
    listCredits: async () => ({ rows: [], total: 0 }),
    listCategories: async () => [],
    countCategories: async () => 0,
    listPosts: async () => [],
    countPosts: async () => 0,
    listRoles: async () => [],
    listRolesIncludingDeleted: async () => [],
    listPermissions: async () => [],
    findUserById: async () => undefined,
    updateUser: async () => undefined,
    findRoleById: async () => undefined,
    listRolePermissions: async () => [],
    listUserRolesDetailed: async () => [],
    updateRoleRecord: async () => undefined,
    replaceRolePermissions: async () => undefined,
    softDeleteRole: async () => undefined,
    restoreRoleRecord: async () => ({ status: 'restored' }),
    replaceUserRoles: async () => undefined,
    findTaxonomy: async () => undefined,
    addTaxonomy: async () => undefined,
    updateTaxonomy: async () => undefined,
    findPost: async () => undefined,
    addPost: async () => undefined,
    updatePost: async () => undefined,
    createId: () => 'generated_id',
    resolvePaymentCapability: () => 'stripe',
    listPaymentReplayPreview: async () => [],
    executePaymentReplay: async () => ({
      status: 'ok',
      summary: { processed: 0, failed: 0, skipped: 0 },
      redirectUrl: '/admin/payments/replay?executed=1',
    }),
    readPublicUiConfig: async () => ({ aiEnabled: true }) as never,
    ...overrides,
  } as AdminRouteDeps;
}

function buildActionDeps(
  overrides: Partial<AdminActionDeps> = {}
): AdminActionDeps {
  const deps = buildDeps(overrides as Partial<AdminRouteDeps>);
  return deps as AdminActionDeps;
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
      splat: 'apikeys',
      title: 'Admin API Keys',
      deps: buildDeps({
        listApikeys: async () => ({
          rows: [
            {
              title: 'Production key',
              key: 'key_1',
              user: { email: 'owner@example.com' },
              status: 'active',
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
      splat: 'subscriptions',
      title: 'Admin Subscriptions',
      deps: buildDeps({
        listSubscriptions: async () => ({
          rows: [
            {
              subscriptionNo: 'sub_1',
              user: { email: 'subscriber@example.com' },
              amount: 1000,
              interval: 'month',
              paymentProvider: 'stripe',
              status: 'active',
              createdAt: new Date('2026-01-01T00:00:00.000Z'),
              currentPeriodEnd: new Date('2026-02-01T00:00:00.000Z'),
            },
          ],
          total: 1,
        }),
      }),
    },
    {
      splat: 'credits',
      title: 'Admin Credits',
      deps: buildDeps({
        listCredits: async () => ({
          rows: [
            {
              transactionNo: 'credit_1',
              user: { email: 'credit@example.com' },
              credits: 10,
              remainingCredits: 20,
              transactionType: 'grant',
              transactionScene: 'admin',
              createdAt: new Date('2026-01-01T00:00:00.000Z'),
              expiresAt: new Date('2027-01-01T00:00:00.000Z'),
            },
          ],
          total: 1,
        }),
      }),
    },
    {
      splat: 'categories',
      title: 'Admin Categories',
      deps: buildDeps({
        listCategories: async () =>
          [
            {
              slug: 'news',
              title: 'News',
              status: 'published',
              createdAt: new Date('2026-01-01T00:00:00.000Z'),
              updatedAt: new Date('2026-01-02T00:00:00.000Z'),
            },
          ] as never,
        countCategories: async () => 1,
      }),
    },
    {
      splat: 'posts',
      title: 'Admin Posts',
      deps: buildDeps({
        listPosts: async () =>
          [
            {
              title: 'Post',
              authorName: 'Editor',
              image: '/post.png',
              categories: 'cat_1',
              createdAt: new Date('2026-01-01T00:00:00.000Z'),
            },
          ] as never,
        countPosts: async () => 1,
      }),
    },
    {
      splat: 'chats',
      title: 'Admin Chats',
      deps: buildDeps({
        listChats: async () => ({
          rows: [
            {
              title: 'Chat',
              user: { email: 'chatter@example.com' },
              status: 'active',
              model: 'gpt-test',
              provider: 'openai',
              createdAt: new Date('2026-01-01T00:00:00.000Z'),
            },
          ],
          total: 1,
        }),
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
    { splat: 'users/user_1/edit', codes: ['admin.users.write'] },
    {
      splat: 'users/user_1/edit-roles',
      codes: ['admin.users.write', 'admin.roles.write'],
    },
    { splat: 'apikeys', codes: ['admin.apikeys.read'] },
    { splat: 'payments', codes: ['admin.payments.read'] },
    { splat: 'payments/replay', codes: ['admin.payments.write'] },
    { splat: 'subscriptions', codes: ['admin.subscriptions.read'] },
    { splat: 'credits', codes: ['admin.credits.read'] },
    { splat: 'roles', codes: ['admin.roles.read'] },
    { splat: 'roles/role_1/edit', codes: ['admin.roles.write'] },
    {
      splat: 'roles/role_1/edit-permissions',
      codes: ['admin.roles.write'],
    },
    { splat: 'roles/role_1/delete', codes: ['admin.roles.delete'] },
    { splat: 'roles/role_1/restore', codes: ['admin.roles.write'] },
    { splat: 'permissions', codes: ['admin.permissions.read'] },
    { splat: 'categories', codes: ['admin.categories.read'] },
    { splat: 'categories/add', codes: ['admin.categories.write'] },
    { splat: 'categories/cat_1/edit', codes: ['admin.categories.write'] },
    { splat: 'posts', codes: ['admin.posts.read'] },
    { splat: 'posts/add', codes: ['admin.posts.write'] },
    { splat: 'posts/post_1/edit', codes: ['admin.posts.write'] },
    { splat: 'chats', codes: ['admin.ai-tasks.read'] },
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
        listSubscriptions: async () => {
          throw new Error('listSubscriptions should not be called');
        },
        listCredits: async () => {
          throw new Error('listCredits should not be called');
        },
        listApikeys: async () => {
          throw new Error('listApikeys should not be called');
        },
        listChats: async () => {
          throw new Error('listChats should not be called');
        },
        listCategories: async () => {
          throw new Error('listCategories should not be called');
        },
        countCategories: async () => {
          throw new Error('countCategories should not be called');
        },
        listPosts: async () => {
          throw new Error('listPosts should not be called');
        },
        countPosts: async () => {
          throw new Error('countPosts should not be called');
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

test('resolveAdminRouteData restores native admin action form routes', async () => {
  const deps = buildDeps({
    findUserById: async (id) => ({
      id,
      email: 'user@example.com',
      name: 'User',
      image: '',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    }),
    listRoles: async () => [
      {
        id: 'role_1',
        name: 'admin',
        title: 'Admin',
        description: 'Admin role',
        status: 'active',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        deletedAt: null,
      },
    ],
    listUserRolesDetailed: async () => [{ id: 'role_1', title: 'Admin' }],
    findRoleById: async (id) => ({
      id,
      name: 'admin',
      title: 'Admin',
      description: 'Admin role',
      status: 'active',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      deletedAt:
        id === 'deleted_role' ? new Date('2026-01-02T00:00:00.000Z') : null,
    }),
    listPermissions: async () => [
      {
        id: 'perm_1',
        code: 'admin.users.read',
        title: 'Read users',
        resource: 'users',
        action: 'read',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      },
    ],
    listRolePermissions: async () => [
      { id: 'perm_1', code: 'admin.users.read' },
    ],
    findTaxonomy: async (input) =>
      ({
        id: input.id ?? 'cat_1',
        userId: 'admin_user',
        slug: 'news',
        title: 'News',
        description: '',
        status: 'published',
      }) as never,
    findPost: async (input) =>
      ({
        id: input.id ?? 'post_1',
        userId: 'admin_user',
        slug: 'hello',
        title: 'Hello',
        description: '',
        categories: 'cat_1',
        image: '',
        authorName: '',
        authorImage: '',
        content: '',
      }) as never,
    listCategories: async () =>
      [
        {
          id: 'cat_1',
          title: 'News',
          slug: 'news',
          status: 'published',
        },
      ] as never,
  });

  const cases: Array<{ splat: string; kind: 'form' | 'payment_replay' }> = [
    { splat: 'users/user_1/edit', kind: 'form' },
    { splat: 'users/user_1/edit-roles', kind: 'form' },
    { splat: 'roles/role_1/edit', kind: 'form' },
    { splat: 'roles/role_1/edit-permissions', kind: 'form' },
    { splat: 'roles/role_1/delete', kind: 'form' },
    { splat: 'roles/deleted_role/restore', kind: 'form' },
    { splat: 'payments/replay', kind: 'payment_replay' },
    { splat: 'categories/add', kind: 'form' },
    { splat: 'categories/cat_1/edit', kind: 'form' },
    { splat: 'posts/add', kind: 'form' },
    { splat: 'posts/post_1/edit', kind: 'form' },
  ];

  for (const entry of cases) {
    const data = await resolveAdminRouteData(
      { locale: 'en', splat: entry.splat },
      deps
    );

    assert.equal(data.status, 'ok');
    assert.equal(data.page.kind, entry.kind);
  }
});

test('resolveAdminRouteData still rejects unknown admin child routes', async () => {
  const splats = ['settings/auth/extra', 'unknown', 'users/user_1/replay'];

  for (const splat of splats) {
    const data = await resolveAdminRouteData(
      { locale: 'en', splat },
      buildDeps()
    );

    assert.deepEqual(data, { status: 'not_found' });
  }
});

test('resolveAdminRouteData hides native admin chats when AI is disabled', async () => {
  const data = await resolveAdminRouteData(
    { locale: 'en', splat: 'chats' },
    buildDeps({
      readPublicUiConfig: async () => ({ aiEnabled: false }) as never,
      listChats: async () => {
        throw new Error('listChats should not be called');
      },
    })
  );

  assert.deepEqual(data, { status: 'not_found' });
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

test('resolveAdminAction persists native admin user role updates', async () => {
  let capturedRoles: string[] | undefined;
  let capturedAudit: { actorUserId?: string; source?: string } | undefined;

  const result = await resolveAdminAction(
    {
      locale: 'en',
      action: 'users.updateRoles',
      id: 'user_1',
      values: { roles: JSON.stringify(['role_1', 'role_2']) },
    },
    buildActionDeps({
      findUserById: async (id) => ({
        id,
        email: 'user@example.com',
        name: 'User',
        image: '',
      }),
      replaceUserRoles: async (_userId, roleIds, audit) => {
        capturedRoles = roleIds;
        capturedAudit = audit;
      },
    })
  );

  assert.equal(result.status, 'success');
  assert.deepEqual(capturedRoles, ['role_1', 'role_2']);
  assert.equal(capturedAudit?.actorUserId, 'admin_user');
});

test('resolveAdminAction persists native admin content forms', async () => {
  let createdCategory:
    | { slug?: string; userId?: string; status?: string }
    | undefined;
  let updatedPost: { slug?: string; status?: string } | undefined;

  const categoryResult = await resolveAdminAction(
    {
      locale: 'en',
      action: 'categories.create',
      values: { slug: 'News', title: 'News', description: '' },
    },
    buildActionDeps({
      addTaxonomy: async (category) => {
        createdCategory = category;
        return category as never;
      },
    })
  );
  const postResult = await resolveAdminAction(
    {
      locale: 'en',
      action: 'posts.update',
      id: 'post_1',
      values: {
        slug: 'Updated',
        title: 'Updated',
        description: '',
        categories: 'cat_1',
        image: '',
        content: '',
        authorName: '',
        authorImage: '',
      },
    },
    buildActionDeps({
      findPost: async () =>
        ({
          id: 'post_1',
          slug: 'old',
          title: 'Old',
        }) as never,
      updatePost: async (_id, post) => {
        updatedPost = post;
        return post as never;
      },
    })
  );

  assert.equal(categoryResult.status, 'success');
  assert.equal(createdCategory?.slug, 'news');
  assert.equal(createdCategory?.userId, 'admin_user');
  assert.equal(createdCategory?.status, 'published');
  assert.equal(postResult.status, 'success');
  assert.equal(updatedPost?.slug, 'updated');
  assert.equal(updatedPost?.status, 'published');
});

test('resolveAdminAction executes payment replay with parsed inbox ids', async () => {
  let captured:
    | { inboxIds: string[]; operationKind: string; actorUserId: string }
    | undefined;

  const result = await resolveAdminAction(
    {
      locale: 'en',
      action: 'payments.replay.execute',
      values: {
        inboxIds: JSON.stringify(['inbox_1']),
        operationKind: 'replay',
        returnPath: '/admin/payments/replay?preview=1',
        note: 'retry',
      },
    },
    buildActionDeps({
      executePaymentReplay: async (input) => {
        captured = input;
        return {
          status: 'ok',
          summary: { processed: 1, failed: 0, skipped: 0 },
          redirectUrl: '/admin/payments/replay?executed=1',
        };
      },
    })
  );

  assert.equal(result.status, 'success');
  assert.deepEqual(captured?.inboxIds, ['inbox_1']);
  assert.equal(captured?.operationKind, 'replay');
  assert.equal(captured?.actorUserId, 'admin_user');
});

test('resolveAdminAction gates native admin writes by section permission', async () => {
  let updated = false;
  const result = await resolveAdminAction(
    {
      locale: 'en',
      action: 'users.update',
      id: 'user_1',
      values: { name: 'User', image: '' },
    },
    buildActionDeps({
      hasAllPermissions: async () => false,
      updateUser: async () => {
        updated = true;
        return { id: 'user_1' } as never;
      },
    })
  );

  assert.equal(result.status, 'error');
  assert.equal(updated, false);
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
