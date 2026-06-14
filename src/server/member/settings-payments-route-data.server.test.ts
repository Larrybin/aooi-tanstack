import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { PaymentType } from '@/domains/billing/domain/payment';

import { defaultLocale, locales } from '@/config/locale';
import { localePath } from '@/shared/i18n/locale';
import { buildCanonicalUrl } from '@/shared/seo/canonical';

import { resolveSettingsPaymentsRouteData } from './settings-payments-route-resolver';

test('resolveSettingsPaymentsRouteData returns null when payment is disabled without reading auth', async () => {
  let authRead = false;

  const data = await resolveSettingsPaymentsRouteData(
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

test('resolveSettingsPaymentsRouteData returns no-auth page without reading payments', async () => {
  let paymentsRead = false;

  const data = await resolveSettingsPaymentsRouteData(
    { locale: defaultLocale },
    {
      resolvePaymentCapability: () => 'stripe',
      readSignedInUserIdentity: async () => null,
      readPayments: async () => {
        paymentsRead = true;
        return emptyPaymentsOverview();
      },
    }
  );

  assert.ok(data);
  assert.equal(data.viewer.signedIn, false);
  assert.equal(data.page.noAuthMessage, 'no auth');
  assert.equal(data.page.records.length, 0);
  assert.equal(paymentsRead, false);
});

test('resolveSettingsPaymentsRouteData returns default signed-in payment data', async () => {
  const data = await resolveSettingsPaymentsRouteData(
    {
      locale: defaultLocale,
      search: '?type=subscription&page=2&pageSize=10&order_no=order-callback',
    },
    {
      resolvePaymentCapability: () => 'stripe',
      readSignedInUserIdentity: async () => fakeSignedInUser(),
      readPayments: async (params) => {
        assert.deepEqual(params, {
          userId: 'user-1',
          paymentType: PaymentType.SUBSCRIPTION,
          page: 2,
          limit: 10,
        });
        return {
          orders: [
            fakePaymentOrder({
              orderNo: 'order-1',
              invoiceId: 'invoice-ignored',
              invoiceUrl: 'https://billing.example.test/invoice-1',
            }),
            fakePaymentOrder({
              id: 'payment-2',
              orderNo: 'order-2',
              invoiceId: 'invoice-2',
              invoiceUrl: null,
            }),
          ],
          total: 30,
        };
      },
    }
  );

  assert.ok(data);
  assert.equal(data.locale, defaultLocale);
  assert.equal(data.canonicalPath, '/settings/payments');
  assert.equal(data.viewer.signedIn, true);
  assert.deepEqual(data.page.query, {
    page: 2,
    pageSize: 10,
    type: 'subscription',
    orderNo: 'order-callback',
  });
  assert.deepEqual(data.page.pagination, {
    total: 30,
    page: 2,
    pageSize: 10,
    previousHref: '/settings/payments?type=subscription&pageSize=10',
    nextHref: '/settings/payments?type=subscription&page=3&pageSize=10',
  });
  assert.equal(
    data.page.records[0]?.invoiceHref,
    'https://billing.example.test/invoice-1'
  );
  assert.equal(data.page.records[0]?.invoiceExternal, true);
  assert.equal(
    data.page.records[1]?.invoiceHref,
    '/settings/invoices/retrieve?order_no=order-2'
  );
  assert.equal(data.page.records[1]?.invoiceExternal, false);
  assert.equal(data.page.records[0]?.price, '$99');
  assert.equal(data.page.records[0]?.paidAmount, '$79');
  assert.equal(data.page.records[0]?.discountAmount, '$20');
  assert.equal(data.page.records[0]?.createdAt, '2026-01-01');
  assert.doesNotThrow(() => JSON.stringify(data));
});

test('resolveSettingsPaymentsRouteData reads TanStack search object and resets tab pages', async () => {
  const data = await resolveSettingsPaymentsRouteData(
    {
      locale: defaultLocale,
      search: { type: 'renew', page: '5', pageSize: '10' },
    },
    {
      resolvePaymentCapability: () => 'stripe',
      readSignedInUserIdentity: async () => fakeSignedInUser(),
      readPayments: async (params) => {
        assert.equal(params.paymentType, PaymentType.RENEW);
        assert.equal(params.page, 5);
        assert.equal(params.limit, 10);
        return { ...emptyPaymentsOverview(), total: 60 };
      },
    }
  );

  assert.ok(data);
  assert.deepEqual(data.page.query, {
    page: 5,
    pageSize: 10,
    type: 'renew',
    orderNo: '',
  });
  assert.equal(data.page.tabs[0]?.href, '/settings/payments?pageSize=10');
  assert.equal(
    data.page.tabs[1]?.href,
    '/settings/payments?type=one-time&pageSize=10'
  );
  assert.equal(
    data.page.pagination.previousHref,
    '/settings/payments?type=renew&page=4&pageSize=10'
  );
});

test('resolveSettingsPaymentsRouteData normalizes invalid query values', async () => {
  const data = await resolveSettingsPaymentsRouteData(
    { locale: defaultLocale, search: '?type=other&page=-1&pageSize=500' },
    {
      resolvePaymentCapability: () => 'stripe',
      readSignedInUserIdentity: async () => fakeSignedInUser(),
      readPayments: async (params) => {
        assert.equal(params.paymentType, undefined);
        assert.equal(params.page, 1);
        assert.equal(params.limit, 100);
        return emptyPaymentsOverview();
      },
    }
  );

  assert.ok(data);
  assert.deepEqual(data.page.query, {
    page: 1,
    pageSize: 100,
    type: 'all',
    orderNo: '',
  });
});

test('resolveSettingsPaymentsRouteData returns localized payment data', async () => {
  const locale = getLocaleWithPaymentsMessages();
  if (!locale) {
    return;
  }

  const data = await resolveSettingsPaymentsRouteData(
    { locale, search: '?type=one-time' },
    {
      resolvePaymentCapability: () => 'stripe',
      readSignedInUserIdentity: async () => fakeSignedInUser(),
      readPayments: async (params) => {
        assert.equal(params.paymentType, PaymentType.ONE_TIME);
        return emptyPaymentsOverview();
      },
    }
  );

  assert.ok(data);
  assert.equal(data.locale, locale);
  assert.equal(data.page.labels.listTitle, '支付');
  assert.equal(data.page.tabs[1]?.title, '一次性');
  assert.deepEqual(
    data.shell.nav.items.map((item) => item.url),
    [
      localePath('/settings/profile', locale),
      localePath('/settings/security', locale),
      localePath('/settings/credits', locale),
      localePath('/settings/billing', locale),
      localePath('/settings/payments', locale),
    ]
  );
  assert.equal(data.shell.nav.items[3]?.active, false);
  assert.equal(data.shell.nav.items[4]?.active, true);
});

test('resolveSettingsPaymentsRouteData returns null for unsupported locale', async () => {
  const data = await resolveSettingsPaymentsRouteData(
    { locale: 'invalid' },
    { resolvePaymentCapability: () => 'stripe' }
  );

  assert.equal(data, null);
});

test('resolveSettingsPaymentsRouteData falls back to base copy when locale payment messages are missing', async () => {
  const locale = getSupportedLocaleMissingPaymentsMessages();
  if (!locale) {
    return;
  }

  const data = await resolveSettingsPaymentsRouteData(
    { locale },
    {
      resolvePaymentCapability: () => 'stripe',
      readSignedInUserIdentity: async () => fakeSignedInUser(),
      readPayments: async () => emptyPaymentsOverview(),
    }
  );

  assert.ok(data);
  assert.equal(data.locale, locale);
  assert.equal(data.page.labels.listTitle, 'Payments');
});

test('resolveSettingsPaymentsRouteData builds canonical and noindex head', async () => {
  const data = await resolveSettingsPaymentsRouteData(
    { locale: defaultLocale },
    {
      resolvePaymentCapability: () => 'stripe',
      readSignedInUserIdentity: async () => fakeSignedInUser(),
      readPayments: async () => emptyPaymentsOverview(),
    }
  );

  assert.ok(data);
  assert.deepEqual(
    data.head.links?.find((link) => link.rel === 'canonical'),
    {
      rel: 'canonical',
      href: buildCanonicalUrl('/settings/payments', defaultLocale),
    }
  );
  assert.deepEqual(
    data.head.meta?.find((meta) => meta.name === 'robots'),
    { name: 'robots', content: 'noindex,nofollow' }
  );
});

test('resolveSettingsPaymentsRouteData returns serializable error result when payment deps fail', async () => {
  const data = await resolveSettingsPaymentsRouteData(
    { locale: defaultLocale },
    {
      resolvePaymentCapability: () => 'stripe',
      readSignedInUserIdentity: async () => fakeSignedInUser(),
      readPayments: async () => {
        throw new Error('db unavailable');
      },
    }
  );

  assert.ok(data);
  assert.equal(data.page.errorMessage, 'Payments could not be loaded');
  assert.equal(data.page.records.length, 0);
  assert.doesNotThrow(() => JSON.stringify(data));
});

test('resolveSettingsPaymentsRouteData is JSON serializable', async () => {
  const data = await resolveSettingsPaymentsRouteData(
    { locale: defaultLocale },
    {
      resolvePaymentCapability: () => 'stripe',
      readSignedInUserIdentity: async () => fakeSignedInUser(),
      readPayments: async () => emptyPaymentsOverview(),
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

function fakePaymentOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: 'payment-1',
    orderNo: 'order-1',
    productName: 'Pro',
    status: 'paid',
    paymentType: PaymentType.SUBSCRIPTION,
    amount: 9900,
    currency: 'USD',
    paymentAmount: 7900,
    paymentCurrency: 'USD',
    discountAmount: 2000,
    discountCurrency: 'USD',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    invoiceId: null,
    invoiceUrl: null,
    ...overrides,
  };
}

function emptyPaymentsOverview() {
  return {
    orders: [],
    total: 0,
  };
}

function getLocaleWithPaymentsMessages() {
  return locales.includes('zh' as (typeof locales)[number]) ? 'zh' : null;
}

function getSupportedLocaleMissingPaymentsMessages() {
  return (
    locales.find(
      (locale) =>
        locale !== defaultLocale &&
        !existsSync(
          join(
            process.cwd(),
            'src/config/locale/messages',
            locale,
            'settings/payments.json'
          )
        )
    ) ?? null
  );
}
