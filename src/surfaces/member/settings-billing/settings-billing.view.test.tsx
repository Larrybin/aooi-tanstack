import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import type { SettingsBillingRouteData } from './settings-billing.types';
import { SettingsBillingRouteView } from './settings-billing.view';

test('SettingsBillingRouteView renders billing callback and subscription actions', () => {
  const html = renderToStaticMarkup(
    <SettingsBillingRouteView data={createSettingsBillingData()} />
  );

  assert.match(html, /Payment callback/);
  assert.match(html, /sub-1/);
  assert.match(html, /Pro/);
  assert.match(html, /settings\/billing\/cancel/);
  assert.match(html, /settings\/billing\/retrieve/);
  assert.match(html, /Manage Subscription/);
  assert.match(html, /Cancel Subscription/);
  assert.doesNotMatch(html, /settings\/invoices\/retrieve/);
});

function createSettingsBillingData(): SettingsBillingRouteData {
  return {
    locale: 'en',
    canonicalPath: '/settings/billing',
    head: {},
    shell: {
      title: 'Settings',
      nav: {
        items: [
          { title: 'Profile', url: '/settings/profile' },
          { title: 'Security', url: '/settings/security' },
          { title: 'Credits', url: '/settings/credits' },
          { title: 'Billing', url: '/settings/billing', active: true },
        ],
      },
      topNav: {
        items: [{ title: 'Settings', url: '/settings/billing' }],
      },
    },
    viewer: {
      signedIn: true,
    },
    page: {
      noAuthMessage: 'Please sign in to continue',
      errorMessage: null,
      purchaseUrl: '/pricing',
      query: {
        page: 1,
        pageSize: 20,
        status: 'all',
        orderNo: 'order-1',
      },
      paymentCallback: {
        orderNo: 'order-1',
        cleanUrl: '/settings/billing',
      },
      currentSubscription: {
        subscriptionNo: 'sub-1',
        planName: 'Pro',
        status: 'active',
        tip: 'Your subscription will auto renew on 2026-02-01',
        manageHref: '/settings/billing/retrieve?subscription_no=sub-1',
      },
      pagination: {
        total: 1,
        page: 1,
        pageSize: 20,
        previousHref: null,
        nextHref: null,
      },
      labels: {
        currentPlanTitle: 'Current Plan',
        noSubscription: 'No plan',
        subscribeButton: 'Subscribe',
        adjustButton: 'Adjust Plan',
        listTitle: 'Subscriptions History',
        subscriptionNo: 'Subscription No',
        interval: 'Interval',
        status: 'Status',
        amount: 'Amount',
        createdAt: 'Created At',
        currentPeriod: 'Current Period',
        endTime: 'End Time',
        copyAction: 'Copy',
        copySuccess: 'Copied',
        previousPage: 'Previous',
        nextPage: 'Next',
        empty: 'No subscription records',
        callbackTitle: 'Payment callback',
        callbackOrderNo: 'Order No',
        callbackClear: 'Clear status',
        callbackFailed: 'Failed to confirm payment',
        manageButton: 'Manage Subscription',
        cancelButton: 'Cancel Subscription',
        action: 'Action',
      },
      tabs: [
        {
          title: 'All',
          status: 'all',
          href: '/settings/billing',
          active: true,
        },
        {
          title: 'Active',
          status: 'active',
          href: '/settings/billing?status=active',
          active: false,
        },
        {
          title: 'Trialing',
          status: 'trialing',
          href: '/settings/billing?status=trialing',
          active: false,
        },
      ],
      records: [
        {
          id: 'subscription-1',
          subscriptionNo: 'sub-1',
          interval: '1-month',
          status: 'active',
          amount: '$99',
          createdAt: '2025-12-15',
          currentPeriod: '2026-01-01 ~ 2026-02-01',
          endTime: '-',
          actions: {
            cancelHref: '/settings/billing/cancel?subscription_no=sub-1',
          },
        },
      ],
    },
  };
}
