import assert from 'node:assert/strict';
import test from 'node:test';

import { defaultLocale } from '@/config/locale';
import { localePath } from '@/shared/i18n/locale';
import { buildCanonicalUrl } from '@/shared/seo/canonical';

import {
  resolveSettingsBillingCancelRouteData,
  resolveSettingsBillingCancelSubmit,
  resolveSettingsBillingPortalRouteData,
  resolveSettingsInvoiceRetrieveRouteData,
} from './settings-billing-action-route-resolver';

test('resolveSettingsBillingCancelRouteData returns null when payment is disabled without reading auth', async () => {
  let authRead = false;

  const data = await resolveSettingsBillingCancelRouteData(
    { locale: defaultLocale, search: '?subscription_no=sub-1' },
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

test('resolveSettingsBillingCancelRouteData validates query before auth', async () => {
  let authRead = false;

  const data = await resolveSettingsBillingCancelRouteData(
    { locale: defaultLocale },
    {
      resolvePaymentCapability: () => 'stripe',
      readSignedInUserIdentity: async () => {
        authRead = true;
        return fakeSignedInUser();
      },
    }
  );

  assert.ok(data);
  assert.equal(data.viewer.signedIn, false);
  assert.equal(data.page.message, 'Invalid subscription number');
  assert.equal(authRead, false);
});

test('resolveSettingsBillingCancelRouteData returns no-auth page without reading subscription', async () => {
  let subscriptionRead = false;

  const data = await resolveSettingsBillingCancelRouteData(
    { locale: defaultLocale, search: '?subscription_no=sub-1' },
    {
      resolvePaymentCapability: () => 'stripe',
      readSignedInUserIdentity: async () => null,
      readCancelableSubscription: async () => {
        subscriptionRead = true;
        return { status: 'not_found' };
      },
    }
  );

  assert.ok(data);
  assert.equal(data.viewer.signedIn, false);
  assert.equal(data.page.message, 'Please sign in to continue');
  assert.equal(subscriptionRead, false);
});

test('resolveSettingsBillingCancelRouteData returns cancel confirmation page', async () => {
  const data = await resolveSettingsBillingCancelRouteData(
    { locale: defaultLocale, search: '?subscription_no=sub-1' },
    {
      resolvePaymentCapability: () => 'stripe',
      readSignedInUserIdentity: async () => fakeSignedInUser(),
      readCancelableSubscription: async (params) => {
        assert.deepEqual(params, {
          subscriptionNo: 'sub-1',
          actorUserId: 'user-1',
        });
        return {
          status: 'ok',
          subscription: fakeSubscription(),
        };
      },
    }
  );

  assert.ok(data);
  assert.equal(data.locale, defaultLocale);
  assert.equal(data.canonicalPath, '/settings/billing/cancel');
  assert.equal(data.viewer.signedIn, true);
  assert.equal(data.page.kind, 'cancel');
  assert.equal(data.page.query.subscriptionNo, 'sub-1');
  assert.equal(data.page.subscription?.subscriptionNo, 'sub-1');
  assert.equal(data.page.subscription?.amount, '$99');
  assert.equal(data.page.subscription?.intervalCycle, 'every 1 month');
  assert.equal(data.page.subscription?.createdAt, '2025-12-15');
  assert.equal(
    data.page.subscription?.currentPeriod,
    '2026-01-01 ~ 2026-02-01'
  );
  assert.equal(data.shell.nav.items[3]?.active, true);
  assert.equal(
    data.head.links?.find((link) => link.rel === 'canonical')?.href,
    buildCanonicalUrl('/settings/billing/cancel', defaultLocale)
  );
  assert.deepEqual(
    data.head.meta?.find((meta) => meta.name === 'robots'),
    { name: 'robots', content: 'noindex,nofollow' }
  );
  assert.doesNotThrow(() => JSON.stringify(data));
});

test('resolveSettingsBillingCancelSubmit cancels and returns localized same-origin redirect', async () => {
  const result = await resolveSettingsBillingCancelSubmit(
    { locale: 'zh', subscriptionNo: 'sub-1' },
    {
      resolvePaymentCapability: () => 'stripe',
      readSignedInUserIdentity: async () => fakeSignedInUser(),
      cancelSubscription: async (params) => {
        assert.deepEqual(params, {
          subscriptionNo: 'sub-1',
          actorUserId: 'user-1',
        });
        return { status: 'ok', nextStatus: 'canceled' };
      },
    }
  );

  assert.deepEqual(result, {
    status: 'success',
    message: 'Subscription canceled',
    redirectTo: localePath('/settings/billing', 'zh'),
  });
});

test('resolveSettingsBillingCancelSubmit maps cancel failures', async () => {
  const result = await resolveSettingsBillingCancelSubmit(
    { locale: defaultLocale, subscriptionNo: 'sub-1' },
    {
      resolvePaymentCapability: () => 'stripe',
      readSignedInUserIdentity: async () => fakeSignedInUser(),
      cancelSubscription: async () => ({ status: 'invalid_status' }),
    }
  );

  assert.deepEqual(result, {
    status: 'error',
    message: 'subscription is not active or trialing',
    redirectTo: null,
  });
});

test('resolveSettingsBillingPortalRouteData redirects to provider billing URL', async () => {
  const data = await resolveSettingsBillingPortalRouteData(
    {
      locale: 'zh',
      search: { subscription_no: 'sub-1' },
    },
    {
      resolvePaymentCapability: () => 'stripe',
      readSignedInUserIdentity: async () => fakeSignedInUser(),
      retrieveBillingPortal: async (params) => {
        assert.deepEqual(params, {
          subscriptionNo: 'sub-1',
          actorUserId: 'user-1',
          returnUrl: buildCanonicalUrl('/settings/billing', 'zh'),
        });
        return {
          status: 'ok',
          billingUrl: 'https://billing.example.test/session',
        };
      },
    }
  );

  assert.ok(data);
  assert.equal(data.redirectHref, 'https://billing.example.test/session');
  assert.equal(data.canonicalPath, '/settings/billing/retrieve');
  assert.doesNotThrow(() => JSON.stringify(data));
});

test('resolveSettingsBillingPortalRouteData maps provider statuses', async () => {
  const data = await resolveSettingsBillingPortalRouteData(
    { locale: defaultLocale, search: '?subscription_no=sub-1' },
    {
      resolvePaymentCapability: () => 'stripe',
      readSignedInUserIdentity: async () => fakeSignedInUser(),
      retrieveBillingPortal: async () => ({ status: 'missing_customer' }),
    }
  );

  assert.ok(data);
  assert.equal(data.redirectHref, null);
  assert.equal(data.page.message, 'Missing payment user ID');
});

test('resolveSettingsBillingPortalRouteData rejects unsafe redirect URLs', async () => {
  const data = await resolveSettingsBillingPortalRouteData(
    { locale: defaultLocale, search: '?subscription_no=sub-1' },
    {
      resolvePaymentCapability: () => 'stripe',
      readSignedInUserIdentity: async () => fakeSignedInUser(),
      retrieveBillingPortal: async () => ({
        status: 'ok',
        billingUrl: 'javascript:alert(1)',
      }),
    }
  );

  assert.ok(data);
  assert.equal(data.redirectHref, null);
  assert.equal(data.page.message, 'Billing URL not found');
});

test('resolveSettingsInvoiceRetrieveRouteData redirects to provider invoice URL', async () => {
  const data = await resolveSettingsInvoiceRetrieveRouteData(
    {
      locale: defaultLocale,
      search: new URLSearchParams('order_no=order-1'),
    },
    {
      resolvePaymentCapability: () => 'stripe',
      readSignedInUserIdentity: async () => fakeSignedInUser(),
      retrieveInvoice: async (params) => {
        assert.deepEqual(params, {
          orderNo: 'order-1',
          actorUserId: 'user-1',
        });
        return {
          status: 'ok',
          invoiceUrl: 'https://billing.example.test/invoice-1',
        };
      },
    }
  );

  assert.ok(data);
  assert.equal(data.redirectHref, 'https://billing.example.test/invoice-1');
  assert.equal(data.canonicalPath, '/settings/invoices/retrieve');
});

test('resolveSettingsInvoiceRetrieveRouteData rejects unsafe redirect URLs', async () => {
  const data = await resolveSettingsInvoiceRetrieveRouteData(
    { locale: defaultLocale, search: '?order_no=order-1' },
    {
      resolvePaymentCapability: () => 'stripe',
      readSignedInUserIdentity: async () => fakeSignedInUser(),
      retrieveInvoice: async () => ({
        status: 'ok',
        invoiceUrl: 'javascript:alert(1)',
      }),
    }
  );

  assert.ok(data);
  assert.equal(data.redirectHref, null);
  assert.equal(data.page.message, 'invoice url not found');
});

test('resolveSettingsInvoiceRetrieveRouteData validates query before auth', async () => {
  let authRead = false;

  const data = await resolveSettingsInvoiceRetrieveRouteData(
    { locale: defaultLocale },
    {
      resolvePaymentCapability: () => 'stripe',
      readSignedInUserIdentity: async () => {
        authRead = true;
        return fakeSignedInUser();
      },
    }
  );

  assert.ok(data);
  assert.equal(data.page.message, 'invalid order no');
  assert.equal(authRead, false);
});

test('settings billing action resolvers return null for unsupported locale', async () => {
  const data = await resolveSettingsBillingPortalRouteData(
    { locale: 'invalid', search: '?subscription_no=sub-1' },
    { resolvePaymentCapability: () => 'stripe' }
  );

  assert.equal(data, null);
});

function fakeSignedInUser() {
  return {
    id: 'user-1',
    name: 'Ada',
    email: 'ada@example.test',
    image: null,
  };
}

function fakeSubscription(overrides: Record<string, unknown> = {}) {
  return {
    subscriptionNo: 'sub-1',
    interval: 'month',
    intervalCount: 1,
    amount: 9900,
    currency: 'USD',
    createdAt: new Date('2025-12-15T00:00:00.000Z'),
    currentPeriodStart: new Date('2026-01-01T00:00:00.000Z'),
    currentPeriodEnd: new Date('2026-02-01T00:00:00.000Z'),
    ...overrides,
  };
}
