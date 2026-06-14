import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import { defaultLocale, locales } from '@/config/locale';
import { localePath } from '@/shared/i18n/locale';
import { buildCanonicalUrl } from '@/shared/seo/canonical';

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
