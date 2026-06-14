import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import { defaultLocale, locales } from '@/config/locale';
import { localePath } from '@/shared/i18n/locale';
import { buildCanonicalUrl } from '@/shared/seo/canonical';

import { resolveSettingsBillingRouteData } from './settings-billing-route-resolver';

test('resolveSettingsBillingRouteData returns null when payment is disabled without reading auth', async () => {
  let authRead = false;

  const data = await resolveSettingsBillingRouteData(
    { locale: defaultLocale },
    {
      resolvePaymentCapability: () => 'none',
      readSignedInUserIdentity: async () => {
        authRead = true;
        return fakeSignedInUser();
      },
    }
  );

  assert.equal(data, null);
  assert.equal(authRead, false);
});

test('resolveSettingsBillingRouteData returns no-auth page without reading billing', async () => {
  let billingRead = false;

  const data = await resolveSettingsBillingRouteData(
    { locale: defaultLocale },
    {
      resolvePaymentCapability: () => 'stripe',
      readSignedInUserIdentity: async () => null,
      readBillingOverview: async () => {
        billingRead = true;
        return emptyBillingOverview();
      },
    }
  );

  assert.ok(data);
  assert.equal(data.viewer.signedIn, false);
  assert.equal(data.page.noAuthMessage, 'Please sign in to continue');
  assert.equal(data.page.records.length, 0);
  assert.equal(billingRead, false);
});

test('resolveSettingsBillingRouteData returns default signed-in billing data', async () => {
  const currentPeriodStart = new Date('2026-01-01T00:00:00.000Z');
  const currentPeriodEnd = new Date('2026-02-01T00:00:00.000Z');
  const createdAt = new Date('2025-12-15T00:00:00.000Z');

  const data = await resolveSettingsBillingRouteData(
    {
      locale: defaultLocale,
      search: '?status=active&page=2&pageSize=10&order_no=order-1',
    },
    {
      resolvePaymentCapability: () => 'stripe',
      readSignedInUserIdentity: async () => fakeSignedInUser(),
      readBillingOverview: async (params) => {
        assert.deepEqual(params, {
          userId: 'user-1',
          status: 'active',
          page: 2,
          limit: 10,
        });
        return {
          currentSubscription: fakeSubscription({
            status: 'active',
            currentPeriodStart,
            currentPeriodEnd,
            createdAt,
          }),
          subscriptions: [
            fakeSubscription({
              status: 'active',
              currentPeriodStart,
              currentPeriodEnd,
              createdAt,
            }),
          ],
          total: 30,
        };
      },
    }
  );

  assert.ok(data);
  assert.equal(data.locale, defaultLocale);
  assert.equal(data.canonicalPath, '/settings/billing');
  assert.equal(data.viewer.signedIn, true);
  assert.deepEqual(data.page.query, {
    page: 2,
    pageSize: 10,
    status: 'active',
    orderNo: 'order-1',
  });
  assert.deepEqual(data.page.paymentCallback, {
    orderNo: 'order-1',
    cleanUrl: '/settings/billing?status=active&page=2&pageSize=10',
  });
  assert.equal(data.page.currentSubscription?.planName, 'Pro');
  assert.equal(
    data.page.currentSubscription?.manageHref,
    '/settings/billing/retrieve?subscription_no=sub-1'
  );
  assert.equal(
    data.page.currentSubscription?.tip,
    'Your subscription will auto renew on 2026-02-01'
  );
  assert.deepEqual(data.page.pagination, {
    total: 30,
    page: 2,
    pageSize: 10,
    previousHref: '/settings/billing?status=active&pageSize=10',
    nextHref: '/settings/billing?status=active&page=3&pageSize=10',
  });
  assert.equal(data.page.records[0]?.amount, '$99');
  assert.equal(data.page.records[0]?.currentPeriod, '2026-01-01 ~ 2026-02-01');
  assert.equal(
    data.page.records[0]?.actions.cancelHref,
    '/settings/billing/cancel?subscription_no=sub-1'
  );
  assert.doesNotThrow(() => JSON.stringify(data));
});

test('resolveSettingsBillingRouteData reads TanStack search object and resets tab pages', async () => {
  const data = await resolveSettingsBillingRouteData(
    {
      locale: defaultLocale,
      search: { status: 'canceled', page: '5', pageSize: '10' },
    },
    {
      resolvePaymentCapability: () => 'stripe',
      readSignedInUserIdentity: async () => fakeSignedInUser(),
      readBillingOverview: async (params) => {
        assert.equal(params.status, 'canceled');
        assert.equal(params.page, 5);
        assert.equal(params.limit, 10);
        return { ...emptyBillingOverview(), total: 60 };
      },
    }
  );

  assert.ok(data);
  assert.deepEqual(data.page.query, {
    page: 5,
    pageSize: 10,
    status: 'canceled',
    orderNo: '',
  });
  assert.equal(data.page.tabs[0]?.href, '/settings/billing?pageSize=10');
  assert.equal(
    data.page.tabs[1]?.href,
    '/settings/billing?status=active&pageSize=10'
  );
  assert.equal(
    data.page.pagination.previousHref,
    '/settings/billing?status=canceled&page=4&pageSize=10'
  );
});

test('resolveSettingsBillingRouteData normalizes invalid query values', async () => {
  const data = await resolveSettingsBillingRouteData(
    { locale: defaultLocale, search: '?status=other&page=-1&pageSize=500' },
    {
      resolvePaymentCapability: () => 'stripe',
      readSignedInUserIdentity: async () => fakeSignedInUser(),
      readBillingOverview: async (params) => {
        assert.equal(params.status, undefined);
        assert.equal(params.page, 1);
        assert.equal(params.limit, 100);
        return emptyBillingOverview();
      },
    }
  );

  assert.ok(data);
  assert.deepEqual(data.page.query, {
    page: 1,
    pageSize: 100,
    status: 'all',
    orderNo: '',
  });
});

test('resolveSettingsBillingRouteData returns localized billing data', async () => {
  const locale = getLocaleWithBillingMessages();
  if (!locale) {
    return;
  }

  const data = await resolveSettingsBillingRouteData(
    { locale, search: '?status=trialing' },
    {
      resolvePaymentCapability: () => 'stripe',
      readSignedInUserIdentity: async () => fakeSignedInUser(),
      readBillingOverview: async (params) => {
        assert.equal(params.status, 'trialing');
        return emptyBillingOverview();
      },
    }
  );

  assert.ok(data);
  assert.equal(data.locale, locale);
  assert.equal(data.page.labels.currentPlanTitle, '当前计划');
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
  assert.equal(data.shell.nav.items[3]?.active, true);
  assert.equal(data.shell.nav.items[4]?.active, false);
  assert.equal(data.shell.nav.items[5]?.active, false);
});

test('resolveSettingsBillingRouteData returns null for unsupported locale', async () => {
  const data = await resolveSettingsBillingRouteData(
    { locale: 'invalid' },
    { resolvePaymentCapability: () => 'stripe' }
  );

  assert.equal(data, null);
});

test('resolveSettingsBillingRouteData falls back to base copy when locale billing messages are missing', async () => {
  const locale = getSupportedLocaleMissingBillingMessages();
  if (!locale) {
    return;
  }

  const data = await resolveSettingsBillingRouteData(
    { locale },
    {
      resolvePaymentCapability: () => 'stripe',
      readSignedInUserIdentity: async () => fakeSignedInUser(),
      readBillingOverview: async () => emptyBillingOverview(),
    }
  );

  assert.ok(data);
  assert.equal(data.locale, locale);
  assert.equal(data.page.labels.currentPlanTitle, 'Current Plan');
});

test('resolveSettingsBillingRouteData builds canonical and noindex head', async () => {
  const data = await resolveSettingsBillingRouteData(
    { locale: defaultLocale },
    {
      resolvePaymentCapability: () => 'stripe',
      readSignedInUserIdentity: async () => fakeSignedInUser(),
      readBillingOverview: async () => emptyBillingOverview(),
    }
  );

  assert.ok(data);
  assert.deepEqual(
    data.head.links?.find((link) => link.rel === 'canonical'),
    {
      rel: 'canonical',
      href: buildCanonicalUrl('/settings/billing', defaultLocale),
    }
  );
  assert.deepEqual(
    data.head.meta?.find((meta) => meta.name === 'robots'),
    { name: 'robots', content: 'noindex,nofollow' }
  );
});

test('resolveSettingsBillingRouteData returns serializable error result when billing deps fail', async () => {
  const data = await resolveSettingsBillingRouteData(
    { locale: defaultLocale },
    {
      resolvePaymentCapability: () => 'stripe',
      readSignedInUserIdentity: async () => fakeSignedInUser(),
      readBillingOverview: async () => {
        throw new Error('db unavailable');
      },
    }
  );

  assert.ok(data);
  assert.equal(data.page.errorMessage, 'Billing could not be loaded');
  assert.equal(data.page.records.length, 0);
  assert.doesNotThrow(() => JSON.stringify(data));
});

test('resolveSettingsBillingRouteData is JSON serializable', async () => {
  const data = await resolveSettingsBillingRouteData(
    { locale: defaultLocale },
    {
      resolvePaymentCapability: () => 'stripe',
      readSignedInUserIdentity: async () => fakeSignedInUser(),
      readBillingOverview: async () => emptyBillingOverview(),
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

function fakeSubscription(
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    id: 'subscription-1',
    subscriptionNo: 'sub-1',
    paymentUserId: 'customer-1',
    interval: 'month',
    intervalCount: 1,
    status: 'active',
    amount: 9900,
    currency: 'USD',
    planName: 'Pro',
    currentPeriodStart: new Date('2026-01-01T00:00:00.000Z'),
    currentPeriodEnd: new Date('2026-02-01T00:00:00.000Z'),
    canceledEndAt: null,
    createdAt: new Date('2025-12-15T00:00:00.000Z'),
    ...overrides,
  };
}

function emptyBillingOverview() {
  return {
    currentSubscription: null,
    subscriptions: [],
    total: 0,
  };
}

function getLocaleWithBillingMessages() {
  return locales.includes('zh' as (typeof locales)[number]) ? 'zh' : null;
}

function getSupportedLocaleMissingBillingMessages() {
  return (
    locales.find(
      (locale) =>
        locale !== defaultLocale &&
        !existsSync(
          join(
            process.cwd(),
            'src/config/locale/messages',
            locale,
            'settings/billing.json'
          )
        )
    ) ?? null
  );
}
