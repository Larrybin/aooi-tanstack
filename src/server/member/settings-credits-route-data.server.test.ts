import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { ACCOUNT_CREDIT_TRANSACTION_TYPE } from '@/domains/account/application/use-cases';

import { defaultLocale, locales } from '@/config/locale';
import { localePath } from '@/shared/i18n/locale';
import { buildCanonicalUrl } from '@/shared/seo/canonical';

import { resolveSettingsCreditsRouteData } from './settings-credits-route-resolver';

test('resolveSettingsCreditsRouteData returns no-auth page without reading credits', async () => {
  let creditsRead = false;

  const data = await resolveSettingsCreditsRouteData(
    { locale: defaultLocale },
    {
      readSignedInUserIdentity: async () => null,
      getRemainingCredits: async () => {
        creditsRead = true;
        return 0;
      },
      creditsListDeps: {
        getCredits: async () => {
          creditsRead = true;
          return [];
        },
        getCreditsCount: async () => {
          creditsRead = true;
          return 0;
        },
      },
    }
  );

  assert.ok(data);
  assert.equal(data.viewer.signedIn, false);
  assert.equal(data.page.noAuthMessage, 'Please sign in to continue');
  assert.equal(data.page.remainingCredits, 0);
  assert.equal(data.page.records.length, 0);
  assert.equal(creditsRead, false);
});

test('resolveSettingsCreditsRouteData returns default signed-in credits data', async () => {
  const expiresAt = new Date('2026-01-02T03:04:05.000Z');
  const createdAt = new Date('2026-01-01T03:04:05.000Z');

  const data = await resolveSettingsCreditsRouteData(
    { locale: defaultLocale, search: '?type=grant&page=2&pageSize=10' },
    {
      readSignedInUserIdentity: async () => fakeSignedInUser(),
      getRemainingCredits: async () => 42,
      creditsListDeps: {
        getCredits: async (params) => {
          assert.equal(params.userId, 'user-1');
          assert.equal(
            params.transactionType,
            ACCOUNT_CREDIT_TRANSACTION_TYPE.GRANT
          );
          assert.equal(params.page, 2);
          assert.equal(params.limit, 10);
          return [
            {
              id: 'credit-1',
              userId: 'user-1',
              transactionNo: 'tx-1',
              description: 'Grant credit',
              transactionType: 'grant',
              transactionScene: 'payment',
              credits: 42,
              expiresAt,
              createdAt,
            },
          ];
        },
        getCreditsCount: async (params) => {
          assert.equal(
            params.transactionType,
            ACCOUNT_CREDIT_TRANSACTION_TYPE.GRANT
          );
          return 1;
        },
      },
    }
  );

  assert.ok(data);
  assert.equal(data.locale, defaultLocale);
  assert.equal(data.canonicalPath, '/settings/credits');
  assert.equal(data.viewer.signedIn, true);
  assert.equal(data.page.remainingCredits, 42);
  assert.deepEqual(data.page.query, {
    page: 2,
    pageSize: 10,
    type: 'grant',
  });
  assert.deepEqual(data.page.pagination, {
    total: 1,
    page: 2,
    pageSize: 10,
    previousHref: '/settings/credits?type=grant&pageSize=10',
    nextHref: null,
  });
  assert.equal(data.page.records[0]?.expiresAt, expiresAt.toISOString());
  assert.equal(data.page.records[0]?.createdAt, createdAt.toISOString());
});

test('resolveSettingsCreditsRouteData normalizes invalid query values', async () => {
  let requestedType: string | undefined;

  const data = await resolveSettingsCreditsRouteData(
    { locale: defaultLocale, type: 'other', page: '-1', pageSize: '500' },
    {
      readSignedInUserIdentity: async () => fakeSignedInUser(),
      getRemainingCredits: async () => 3,
      creditsListDeps: {
        getCredits: async (params) => {
          requestedType = params.transactionType;
          assert.equal(params.page, 1);
          assert.equal(params.limit, 100);
          return [];
        },
        getCreditsCount: async () => 0,
      },
    }
  );

  assert.ok(data);
  assert.equal(requestedType, undefined);
  assert.deepEqual(data.page.query, {
    page: 1,
    pageSize: 100,
    type: 'all',
  });
});

test('resolveSettingsCreditsRouteData reads TanStack search object values', async () => {
  const data = await resolveSettingsCreditsRouteData(
    {
      locale: defaultLocale,
      search: { type: 'grant', page: '2', pageSize: '10' },
    },
    {
      readSignedInUserIdentity: async () => fakeSignedInUser(),
      getRemainingCredits: async () => 3,
      creditsListDeps: {
        getCredits: async (params) => {
          assert.equal(
            params.transactionType,
            ACCOUNT_CREDIT_TRANSACTION_TYPE.GRANT
          );
          assert.equal(params.page, 2);
          assert.equal(params.limit, 10);
          return [];
        },
        getCreditsCount: async () => 30,
      },
    }
  );

  assert.ok(data);
  assert.deepEqual(data.page.query, {
    page: 2,
    pageSize: 10,
    type: 'grant',
  });
  assert.equal(
    data.page.pagination.previousHref,
    '/settings/credits?type=grant&pageSize=10'
  );
  assert.equal(
    data.page.pagination.nextHref,
    '/settings/credits?type=grant&page=3&pageSize=10'
  );
  assert.equal(data.page.tabs[0]?.href, '/settings/credits?pageSize=10');
  assert.equal(
    data.page.tabs[1]?.href,
    '/settings/credits?type=grant&pageSize=10'
  );
});

test('resolveSettingsCreditsRouteData links out-of-range empty pages back to the last page', async () => {
  const data = await resolveSettingsCreditsRouteData(
    { locale: defaultLocale, search: '?page=999&pageSize=10' },
    {
      readSignedInUserIdentity: async () => fakeSignedInUser(),
      getRemainingCredits: async () => 3,
      creditsListDeps: {
        getCredits: async (params) => {
          assert.equal(params.page, 999);
          assert.equal(params.limit, 10);
          return [];
        },
        getCreditsCount: async () => 30,
      },
    }
  );

  assert.ok(data);
  assert.equal(data.page.records.length, 0);
  assert.deepEqual(data.page.pagination, {
    total: 30,
    page: 999,
    pageSize: 10,
    previousHref: '/settings/credits?page=3&pageSize=10',
    nextHref: null,
  });
});

test('resolveSettingsCreditsRouteData returns localized credits data', async () => {
  const locale = getLocaleWithCreditsMessages();
  if (!locale) {
    return;
  }

  const data = await resolveSettingsCreditsRouteData(
    { locale, search: '?type=consume' },
    {
      readSignedInUserIdentity: async () => fakeSignedInUser(),
      getRemainingCredits: async () => 9,
      creditsListDeps: {
        getCredits: async (params) => {
          assert.equal(
            params.transactionType,
            ACCOUNT_CREDIT_TRANSACTION_TYPE.CONSUME
          );
          return [];
        },
        getCreditsCount: async () => 0,
      },
    }
  );

  assert.ok(data);
  assert.equal(data.locale, locale);
  assert.equal(data.page.labels.balanceTitle, '积分余额');
  assert.equal(data.page.labels.copyAction, '操作');
  assert.equal(data.page.labels.copySuccess, 'Copied');
  assert.equal(
    data.page.tabs[2]?.href,
    localePath('/settings/credits', locale) + '?type=consume'
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
  assert.equal(data.shell.nav.items[2]?.active, true);
  assert.equal(data.shell.nav.items[3]?.active, false);
  assert.equal(data.shell.nav.items[4]?.active, false);
  assert.equal(data.shell.nav.items[5]?.active, false);
});

test('resolveSettingsCreditsRouteData returns null for unsupported locale', async () => {
  const data = await resolveSettingsCreditsRouteData(
    { locale: 'invalid' },
    { readSignedInUserIdentity: async () => fakeSignedInUser() }
  );

  assert.equal(data, null);
});

test('resolveSettingsCreditsRouteData falls back to base copy when locale credits messages are missing', async () => {
  const locale = getSupportedLocaleMissingCreditsMessages();
  if (!locale) {
    return;
  }

  const data = await resolveSettingsCreditsRouteData(
    { locale },
    {
      readSignedInUserIdentity: async () => fakeSignedInUser(),
      getRemainingCredits: async () => 0,
      creditsListDeps: {
        getCredits: async () => [],
        getCreditsCount: async () => 0,
      },
    }
  );

  assert.ok(data);
  assert.equal(data.locale, locale);
  assert.equal(data.page.labels.balanceTitle, 'Credits Balance');
});

test('resolveSettingsCreditsRouteData builds canonical and noindex head', async () => {
  const data = await resolveSettingsCreditsRouteData(
    { locale: defaultLocale },
    {
      readSignedInUserIdentity: async () => fakeSignedInUser(),
      getRemainingCredits: async () => 0,
      creditsListDeps: {
        getCredits: async () => [],
        getCreditsCount: async () => 0,
      },
    }
  );

  assert.ok(data);
  assert.deepEqual(
    data.head.links?.find((link) => link.rel === 'canonical'),
    {
      rel: 'canonical',
      href: buildCanonicalUrl('/settings/credits', defaultLocale),
    }
  );
  assert.deepEqual(
    data.head.meta?.find((meta) => meta.name === 'robots'),
    { name: 'robots', content: 'noindex,nofollow' }
  );
});

test('resolveSettingsCreditsRouteData returns serializable error result when credit deps fail', async () => {
  const data = await resolveSettingsCreditsRouteData(
    { locale: defaultLocale },
    {
      readSignedInUserIdentity: async () => fakeSignedInUser(),
      getRemainingCredits: async () => {
        throw new Error('db unavailable');
      },
      creditsListDeps: {
        getCredits: async () => [],
        getCreditsCount: async () => 0,
      },
    }
  );

  assert.ok(data);
  assert.equal(data.page.errorMessage, 'Credits could not be loaded');
  assert.equal(data.page.records.length, 0);
  assert.doesNotThrow(() => JSON.stringify(data));
});

test('resolveSettingsCreditsRouteData is JSON serializable', async () => {
  const data = await resolveSettingsCreditsRouteData(
    { locale: defaultLocale },
    {
      readSignedInUserIdentity: async () => fakeSignedInUser(),
      getRemainingCredits: async () => 1,
      creditsListDeps: {
        getCredits: async () => [],
        getCreditsCount: async () => 0,
      },
    }
  );

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

function getLocaleWithCreditsMessages() {
  return locales.includes('zh' as (typeof locales)[number]) ? 'zh' : null;
}

function getSupportedLocaleMissingCreditsMessages() {
  return (
    locales.find(
      (locale) =>
        locale !== defaultLocale &&
        !existsSync(
          join(
            process.cwd(),
            'src/config/locale/messages',
            locale,
            'settings/credits.json'
          )
        )
    ) ?? null
  );
}
