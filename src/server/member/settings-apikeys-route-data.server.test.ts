import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import { defaultLocale, locales } from '@/config/locale';
import { localePath } from '@/shared/i18n/locale';
import { buildCanonicalUrl } from '@/shared/seo/canonical';

import {
  resolveSettingsApiKeyCreate,
  resolveSettingsApiKeysCreateRouteData,
} from './settings-apikeys-create-route-resolver';
import {
  resolveSettingsApiKeyDelete,
  resolveSettingsApiKeysIdRouteData,
  resolveSettingsApiKeyUpdate,
} from './settings-apikeys-id-route-resolver';
import { resolveSettingsApiKeysRouteData } from './settings-apikeys-route-resolver';

test('resolveSettingsApiKeysRouteData returns no-auth page without reading API keys', async () => {
  let apiKeysRead = false;

  const data = await resolveSettingsApiKeysRouteData(
    { locale: defaultLocale },
    {
      readSignedInUserIdentity: async () => null,
      apikeyListDeps: {
        getApikeys: async () => {
          apiKeysRead = true;
          return [];
        },
        getApikeysCount: async () => {
          apiKeysRead = true;
          return 0;
        },
      },
    }
  );

  assert.ok(data);
  assert.equal(data.viewer.signedIn, false);
  assert.equal(data.page.noAuthMessage, 'no auth');
  assert.equal(data.page.records.length, 0);
  assert.equal(apiKeysRead, false);
});

test('resolveSettingsApiKeysRouteData returns signed-in API key list data', async () => {
  const data = await resolveSettingsApiKeysRouteData(
    { locale: defaultLocale, search: '?page=2&pageSize=10' },
    {
      readSignedInUserIdentity: async () => fakeSignedInUser(),
      apikeyListDeps: {
        getApikeys: async (params) => {
          assert.deepEqual(params, {
            userId: 'user-1',
            status: 'active',
            page: 2,
            limit: 10,
          });
          return [
            fakeApiKey({
              id: 'key-1',
              title: 'Default',
              key: 'sk-test-1',
              createdAt: new Date('2026-01-01T00:00:00.000Z'),
            }),
          ];
        },
        getApikeysCount: async (params) => {
          assert.deepEqual(params, {
            userId: 'user-1',
            status: 'active',
          });
          return 30;
        },
      },
    }
  );

  assert.ok(data);
  assert.equal(data.locale, defaultLocale);
  assert.equal(data.canonicalPath, '/settings/apikeys');
  assert.equal(data.viewer.signedIn, true);
  assert.deepEqual(data.page.query, {
    page: 2,
    pageSize: 10,
  });
  assert.deepEqual(data.page.pagination, {
    total: 30,
    page: 2,
    pageSize: 10,
    previousHref: '/settings/apikeys?pageSize=10',
    nextHref: '/settings/apikeys?page=3&pageSize=10',
  });
  assert.equal(data.page.createHref, '/settings/apikeys/create');
  assert.deepEqual(data.page.records[0], {
    id: 'key-1',
    title: 'Default',
    key: 'sk-test-1',
    createdAt: '2026-01-01',
    editHref: '/settings/apikeys/key-1/edit',
    deleteHref: '/settings/apikeys/key-1/delete',
  });
  assert.doesNotThrow(() => JSON.stringify(data));
});

test('resolveSettingsApiKeysRouteData reads TanStack search object values', async () => {
  const data = await resolveSettingsApiKeysRouteData(
    { locale: defaultLocale, search: { page: '3', pageSize: '5' } },
    {
      readSignedInUserIdentity: async () => fakeSignedInUser(),
      apikeyListDeps: {
        getApikeys: async (params) => {
          assert.equal(params.page, 3);
          assert.equal(params.limit, 5);
          return [];
        },
        getApikeysCount: async () => 15,
      },
    }
  );

  assert.ok(data);
  assert.deepEqual(data.page.query, {
    page: 3,
    pageSize: 5,
  });
  assert.equal(
    data.page.pagination.previousHref,
    '/settings/apikeys?page=2&pageSize=5'
  );
});

test('resolveSettingsApiKeysRouteData normalizes invalid query values', async () => {
  const data = await resolveSettingsApiKeysRouteData(
    { locale: defaultLocale, search: '?page=-1&pageSize=500' },
    {
      readSignedInUserIdentity: async () => fakeSignedInUser(),
      apikeyListDeps: {
        getApikeys: async (params) => {
          assert.equal(params.page, 1);
          assert.equal(params.limit, 100);
          return [];
        },
        getApikeysCount: async () => 0,
      },
    }
  );

  assert.ok(data);
  assert.deepEqual(data.page.query, {
    page: 1,
    pageSize: 100,
  });
});

test('resolveSettingsApiKeysRouteData returns localized API key data', async () => {
  const locale = getLocaleWithApiKeysMessages();
  if (!locale) {
    return;
  }

  const data = await resolveSettingsApiKeysRouteData(
    { locale },
    {
      readSignedInUserIdentity: async () => fakeSignedInUser(),
      apikeyListDeps: {
        getApikeys: async () => [fakeApiKey()],
        getApikeysCount: async () => 1,
      },
    }
  );

  assert.ok(data);
  assert.equal(data.locale, locale);
  assert.equal(data.page.labels.listTitle, 'API 密钥');
  assert.equal(
    data.page.createHref,
    localePath('/settings/apikeys/create', locale)
  );
  assert.deepEqual(
    data.shell.nav.items.map((item) => item.url),
    [
      localePath('/settings/profile', locale),
      localePath('/settings/security', locale),
      localePath('/settings/credits', locale),
      localePath('/settings/billing', locale),
      localePath('/settings/payments', locale),
      localePath('/settings/apikeys', locale),
    ]
  );
  assert.equal(data.shell.nav.items[4]?.active, false);
  assert.equal(data.shell.nav.items[5]?.active, true);
});

test('resolveSettingsApiKeysRouteData returns null for unsupported locale', async () => {
  const data = await resolveSettingsApiKeysRouteData({ locale: 'invalid' });

  assert.equal(data, null);
});

test('resolveSettingsApiKeysRouteData falls back to base copy when locale API key messages are missing', async () => {
  const locale = getSupportedLocaleMissingApiKeysMessages();
  if (!locale) {
    return;
  }

  const data = await resolveSettingsApiKeysRouteData(
    { locale },
    {
      readSignedInUserIdentity: async () => fakeSignedInUser(),
      apikeyListDeps: {
        getApikeys: async () => [],
        getApikeysCount: async () => 0,
      },
    }
  );

  assert.ok(data);
  assert.equal(data.locale, locale);
  assert.equal(data.page.labels.listTitle, 'API Keys');
});

test('resolveSettingsApiKeysRouteData builds canonical and noindex head', async () => {
  const data = await resolveSettingsApiKeysRouteData(
    { locale: defaultLocale },
    {
      readSignedInUserIdentity: async () => fakeSignedInUser(),
      apikeyListDeps: {
        getApikeys: async () => [],
        getApikeysCount: async () => 0,
      },
    }
  );

  assert.ok(data);
  assert.deepEqual(
    data.head.links?.find((link) => link.rel === 'canonical'),
    {
      rel: 'canonical',
      href: buildCanonicalUrl('/settings/apikeys', defaultLocale),
    }
  );
  assert.deepEqual(
    data.head.meta?.find((meta) => meta.name === 'robots'),
    { name: 'robots', content: 'noindex,nofollow' }
  );
});

test('resolveSettingsApiKeysRouteData returns serializable error result when API key deps fail', async () => {
  const data = await resolveSettingsApiKeysRouteData(
    { locale: defaultLocale },
    {
      readSignedInUserIdentity: async () => fakeSignedInUser(),
      apikeyListDeps: {
        getApikeys: async () => {
          throw new Error('db unavailable');
        },
        getApikeysCount: async () => 0,
      },
    }
  );

  assert.ok(data);
  assert.equal(data.page.errorMessage, 'API keys could not be loaded');
  assert.equal(data.page.records.length, 0);
  assert.doesNotThrow(() => JSON.stringify(data));
});

test('resolveSettingsApiKeysCreateRouteData returns create form data', async () => {
  const data = await resolveSettingsApiKeysCreateRouteData(
    { locale: defaultLocale },
    { readSignedInUserIdentity: async () => fakeSignedInUser() }
  );

  assert.ok(data);
  assert.equal(data.canonicalPath, '/settings/apikeys/create');
  assert.equal(data.viewer.signedIn, true);
  assert.equal(data.page.title, 'Create API Key');
  assert.equal(data.page.fields.title, 'Title');
  assert.equal(data.page.submitButtonTitle, 'Create');
  assert.equal(data.page.backHref, '/settings/apikeys');
  assert.deepEqual(
    data.head.links?.find((link) => link.rel === 'canonical'),
    {
      rel: 'canonical',
      href: buildCanonicalUrl('/settings/apikeys/create', defaultLocale),
    }
  );
  assert.equal(data.shell.nav.items[5]?.active, true);
  assert.doesNotThrow(() => JSON.stringify(data));
});

test('resolveSettingsApiKeysCreateRouteData returns no-auth create form data without mutation deps', async () => {
  const data = await resolveSettingsApiKeysCreateRouteData(
    { locale: defaultLocale },
    { readSignedInUserIdentity: async () => null }
  );

  assert.ok(data);
  assert.equal(data.viewer.signedIn, false);
  assert.equal(data.page.noAuthMessage, 'no auth');
});

test('resolveSettingsApiKeysCreateRouteData returns localized create form data', async () => {
  const locale = getLocaleWithApiKeysMessages();
  if (!locale) {
    return;
  }

  const data = await resolveSettingsApiKeysCreateRouteData(
    { locale },
    { readSignedInUserIdentity: async () => fakeSignedInUser() }
  );

  assert.ok(data);
  assert.equal(data.page.title, '创建 API 密钥');
  assert.equal(data.page.backHref, localePath('/settings/apikeys', locale));
  assert.equal(
    data.shell.topNav.items[0]?.url,
    localePath('/settings/apikeys/create', locale)
  );
});

test('resolveSettingsApiKeysCreateRouteData returns null for unsupported locale', async () => {
  const data = await resolveSettingsApiKeysCreateRouteData({
    locale: 'invalid',
  });

  assert.equal(data, null);
});

test('resolveSettingsApiKeyCreate creates API key and returns localized redirect', async () => {
  const created: Array<Record<string, unknown>> = [];
  const result = await resolveSettingsApiKeyCreate(
    { locale: 'zh', title: '  Default  ' },
    {
      readSignedInUserIdentity: async () => fakeSignedInUser(),
      apikeyCreateDeps: {
        createId: () => 'key-created',
        createSecretKey: () => 'sk-created',
        createApikey: async (record) => {
          created.push(record);
          return fakeApiKey(record);
        },
      },
    }
  );

  assert.deepEqual(created, [
    {
      id: 'key-created',
      userId: 'user-1',
      title: 'Default',
      key: 'sk-created',
      status: 'active',
    },
  ]);
  assert.deepEqual(result, {
    status: 'success',
    message: 'API Key created',
    redirect_url: localePath('/settings/apikeys', 'zh'),
  });
});

test('resolveSettingsApiKeyCreate rejects invalid create input', async () => {
  assert.deepEqual(
    await resolveSettingsApiKeyCreate({ locale: 'invalid', title: 'Default' }),
    { status: 'error', message: 'Invalid locale' }
  );
  assert.deepEqual(
    await resolveSettingsApiKeyCreate({
      locale: defaultLocale,
      title: ' ',
    }),
    { status: 'error', message: 'title is required' }
  );
  assert.deepEqual(
    await resolveSettingsApiKeyCreate(
      { locale: defaultLocale, title: 'Default' },
      { readSignedInUserIdentity: async () => null }
    ),
    { status: 'error', message: 'no auth' }
  );
});

test('resolveSettingsApiKeyCreate maps create dependency failures', async () => {
  const result = await resolveSettingsApiKeyCreate(
    { locale: defaultLocale, title: 'Default' },
    {
      readSignedInUserIdentity: async () => fakeSignedInUser(),
      apikeyCreateDeps: {
        createId: () => 'key-created',
        createSecretKey: () => 'sk-created',
        createApikey: async () => {
          throw new Error('db unavailable');
        },
      },
    }
  );

  assert.deepEqual(result, {
    status: 'error',
    message: 'API key creation failed',
  });
});

test('resolveSettingsApiKeysIdRouteData returns edit form data', async () => {
  const data = await resolveSettingsApiKeysIdRouteData(
    { locale: defaultLocale, id: 'key-1', mode: 'edit' },
    {
      readSignedInUserIdentity: async () => fakeSignedInUser(),
      apikeyOwnershipDeps: {
        findApikeyById: async () => fakeApiKey(),
      },
    }
  );

  assert.ok(data);
  assert.equal(data.canonicalPath, '/settings/apikeys/key-1/edit');
  assert.equal(data.page.mode, 'edit');
  assert.equal(data.page.title, 'Edit API Key');
  assert.ok(data.page.apikey);
  assert.deepEqual(data.page.apikey, {
    id: 'key-1',
    title: 'Default',
  });
  assert.equal('key' in data.page.apikey, false);
  assert.equal(data.page.backHref, '/settings/apikeys');
  assert.deepEqual(
    data.head.links?.find((link) => link.rel === 'canonical'),
    {
      rel: 'canonical',
      href: buildCanonicalUrl('/settings/apikeys/key-1/edit', defaultLocale),
    }
  );
  assert.doesNotThrow(() => JSON.stringify(data));
});

test('resolveSettingsApiKeysIdRouteData returns delete form data', async () => {
  const data = await resolveSettingsApiKeysIdRouteData(
    { locale: defaultLocale, id: 'key-1', mode: 'delete' },
    {
      readSignedInUserIdentity: async () => fakeSignedInUser(),
      apikeyOwnershipDeps: {
        findApikeyById: async () => fakeApiKey(),
      },
    }
  );

  assert.ok(data);
  assert.equal(data.canonicalPath, '/settings/apikeys/key-1/delete');
  assert.equal(data.page.mode, 'delete');
  assert.equal(data.page.title, 'Delete API Key');
  assert.equal(data.page.labels.submit, 'Confirm Delete');
  assert.equal(data.page.apikey?.key, 'sk-test-1');
});

test('resolveSettingsApiKeysIdRouteData handles no-auth and no-permission states', async () => {
  const noAuth = await resolveSettingsApiKeysIdRouteData(
    { locale: defaultLocale, id: 'key-1', mode: 'edit' },
    { readSignedInUserIdentity: async () => null }
  );

  assert.ok(noAuth);
  assert.equal(noAuth.viewer.signedIn, false);
  assert.equal(noAuth.page.message, 'no auth');
  assert.equal(noAuth.page.apikey, null);

  const forbidden = await resolveSettingsApiKeysIdRouteData(
    { locale: defaultLocale, id: 'key-1', mode: 'edit' },
    {
      readSignedInUserIdentity: async () => fakeSignedInUser(),
      apikeyOwnershipDeps: {
        findApikeyById: async () => fakeApiKey({ userId: 'other-user' }),
      },
    }
  );

  assert.ok(forbidden);
  assert.equal(forbidden.page.message, 'no permission');
  assert.equal(forbidden.page.apikey, null);
});

test('resolveSettingsApiKeysIdRouteData returns localized edit data', async () => {
  const locale = getLocaleWithApiKeysMessages();
  if (!locale) {
    return;
  }

  const data = await resolveSettingsApiKeysIdRouteData(
    { locale, id: 'key-1', mode: 'edit' },
    {
      readSignedInUserIdentity: async () => fakeSignedInUser(),
      apikeyOwnershipDeps: {
        findApikeyById: async () => fakeApiKey(),
      },
    }
  );

  assert.ok(data);
  assert.equal(data.page.title, '编辑 API 密钥');
  assert.equal(data.page.backHref, localePath('/settings/apikeys', locale));
  assert.equal(
    data.shell.topNav.items[0]?.url,
    localePath('/settings/apikeys/key-1/edit', locale)
  );
});

test('resolveSettingsApiKeysIdRouteData returns null for invalid input', async () => {
  assert.equal(
    await resolveSettingsApiKeysIdRouteData({
      locale: 'invalid',
      id: 'key-1',
      mode: 'edit',
    }),
    null
  );
  assert.equal(
    await resolveSettingsApiKeysIdRouteData({
      locale: defaultLocale,
      id: '',
      mode: 'edit',
    }),
    null
  );
});

test('resolveSettingsApiKeyUpdate renames owned API key', async () => {
  const updates: Array<{ id: string; update: Record<string, unknown> }> = [];
  const result = await resolveSettingsApiKeyUpdate(
    { locale: 'zh', id: 'key-1', title: '  Renamed  ' },
    {
      readSignedInUserIdentity: async () => fakeSignedInUser(),
      apikeyMutationDeps: {
        findApikeyById: async () => fakeApiKey(),
        updateApikey: async (id, update) => {
          updates.push({ id, update });
          return fakeApiKey({ id, ...update });
        },
      },
    }
  );

  assert.deepEqual(updates, [
    {
      id: 'key-1',
      update: { title: 'Renamed' },
    },
  ]);
  assert.deepEqual(result, {
    status: 'success',
    message: 'API Key updated',
    redirect_url: localePath('/settings/apikeys', 'zh'),
  });
});

test('resolveSettingsApiKeyDelete soft deletes owned API key', async () => {
  const updates: Array<{ id: string; update: Record<string, unknown> }> = [];
  const result = await resolveSettingsApiKeyDelete(
    { locale: defaultLocale, id: 'key-1', title: 'Default' },
    {
      readSignedInUserIdentity: async () => fakeSignedInUser(),
      apikeyMutationDeps: {
        findApikeyById: async () => fakeApiKey(),
        updateApikey: async (id, update) => {
          updates.push({ id, update });
          return fakeApiKey({ id, ...update });
        },
      },
    }
  );

  assert.equal(updates.length, 1);
  assert.equal(updates[0]?.id, 'key-1');
  assert.equal(updates[0]?.update.status, 'deleted');
  assert.ok(updates[0]?.update.deletedAt instanceof Date);
  assert.deepEqual(result, {
    status: 'success',
    message: 'API Key deleted',
    redirect_url: '/settings/apikeys',
  });
});

test('resolveSettingsApiKeyUpdate and delete reject invalid mutation input', async () => {
  assert.deepEqual(
    await resolveSettingsApiKeyUpdate({
      locale: 'invalid',
      id: 'key-1',
      title: 'Default',
    }),
    { status: 'error', message: 'Invalid locale' }
  );
  assert.deepEqual(
    await resolveSettingsApiKeyUpdate({
      locale: defaultLocale,
      id: 'key-1',
      title: '',
    }),
    { status: 'error', message: 'title is required' }
  );
  assert.deepEqual(
    await resolveSettingsApiKeyDelete({
      locale: defaultLocale,
      id: 'key-1',
      title: '',
    }),
    { status: 'error', message: 'title is required' }
  );
});

test('resolveSettingsApiKeyUpdate and delete enforce ownership', async () => {
  assert.deepEqual(
    await resolveSettingsApiKeyUpdate(
      { locale: defaultLocale, id: 'key-1', title: 'Default' },
      { readSignedInUserIdentity: async () => null }
    ),
    { status: 'error', message: 'no auth' }
  );
  assert.deepEqual(
    await resolveSettingsApiKeyDelete(
      { locale: defaultLocale, id: 'key-1', title: 'Default' },
      {
        readSignedInUserIdentity: async () => fakeSignedInUser(),
        apikeyMutationDeps: {
          findApikeyById: async () => fakeApiKey({ userId: 'other-user' }),
          updateApikey: async () => {
            throw new Error('should not update');
          },
        },
      }
    ),
    { status: 'error', message: 'no permission' }
  );
});

test('resolveSettingsApiKeyUpdate and delete map dependency failures', async () => {
  const failingDeps = {
    findApikeyById: async () => fakeApiKey(),
    updateApikey: async () => {
      throw new Error('db unavailable');
    },
  };

  assert.deepEqual(
    await resolveSettingsApiKeyUpdate(
      { locale: defaultLocale, id: 'key-1', title: 'Default' },
      {
        readSignedInUserIdentity: async () => fakeSignedInUser(),
        apikeyMutationDeps: failingDeps,
      }
    ),
    { status: 'error', message: 'API key update failed' }
  );
  assert.deepEqual(
    await resolveSettingsApiKeyDelete(
      { locale: defaultLocale, id: 'key-1', title: 'Default' },
      {
        readSignedInUserIdentity: async () => fakeSignedInUser(),
        apikeyMutationDeps: failingDeps,
      }
    ),
    { status: 'error', message: 'API key deletion failed' }
  );
});

function fakeSignedInUser() {
  return {
    id: 'user-1',
    name: 'Ada',
    email: 'ada@example.test',
    image: null,
  };
}

function fakeApiKey(overrides: Record<string, unknown> = {}) {
  return {
    id: 'key-1',
    userId: 'user-1',
    title: 'Default',
    key: 'sk-test-1',
    status: 'active',
    deletedAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function getLocaleWithApiKeysMessages() {
  return locales.includes('zh' as (typeof locales)[number]) ? 'zh' : null;
}

function getSupportedLocaleMissingApiKeysMessages() {
  return (
    locales.find(
      (locale) =>
        locale !== defaultLocale &&
        !existsSync(
          join(
            process.cwd(),
            'src/config/locale/messages',
            locale,
            'settings/apikeys.json'
          )
        )
    ) ?? null
  );
}
