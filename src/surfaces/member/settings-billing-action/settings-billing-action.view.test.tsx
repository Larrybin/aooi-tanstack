import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import type { SettingsBillingActionRouteData } from './settings-billing-action.types';
import { SettingsBillingActionRouteView } from './settings-billing-action.view';

test('SettingsBillingActionRouteView renders explicit cancel form', () => {
  const html = renderToStaticMarkup(
    <SettingsBillingActionRouteView data={createCancelData()} />
  );

  assert.match(html, /Cancel Subscription/);
  assert.match(html, /sub-1/);
  assert.match(html, /\$99/);
  assert.match(html, /Confirm Cancel/);
  assert.match(html, /href="\/settings\/billing"/);
  assert.doesNotMatch(html, /settings\/billing\/retrieve/);
  assert.doesNotMatch(html, /settings\/invoices\/retrieve/);
});

test('SettingsBillingActionRouteView renders message pages without action form', () => {
  const html = renderToStaticMarkup(
    <SettingsBillingActionRouteView
      data={{
        ...createCancelData(),
        page: {
          ...createCancelData().page,
          kind: 'message',
          message: 'Please sign in to continue',
          subscription: null,
        },
      }}
    />
  );

  assert.match(html, /Please sign in to continue/);
  assert.doesNotMatch(html, /Confirm Cancel/);
});

function createCancelData(): SettingsBillingActionRouteData {
  return {
    locale: 'en',
    canonicalPath: '/settings/billing/cancel',
    redirectHref: null,
    head: {},
    shell: {
      title: 'Settings',
      nav: {
        items: [
          { title: 'Profile', url: '/settings/profile' },
          { title: 'Security', url: '/settings/security' },
          { title: 'Credits', url: '/settings/credits' },
          { title: 'Billing', url: '/settings/billing', active: true },
          { title: 'Payments', url: '/settings/payments' },
        ],
      },
      topNav: {
        items: [{ title: 'Settings', url: '/settings/billing/cancel' }],
      },
    },
    viewer: {
      signedIn: true,
    },
    page: {
      kind: 'cancel',
      title: 'Cancel Subscription',
      description: 'Are you sure you want to cancel your subscription?',
      message: null,
      backHref: '/settings/billing',
      query: {
        subscriptionNo: 'sub-1',
        orderNo: '',
      },
      labels: {
        subscriptionNo: 'Subscription No',
        subscriptionAmount: 'Subscription Amount',
        intervalCycle: 'Interval Cycle',
        subscriptionCreatedAt: 'Subscription Created At',
        currentPeriod: 'Current Period',
        submit: 'Confirm Cancel',
        back: 'Back to billing',
        success: 'Subscription canceled',
      },
      subscription: {
        subscriptionNo: 'sub-1',
        amount: '$99',
        intervalCycle: 'every 1 month',
        createdAt: '2025-12-15',
        currentPeriod: '2026-01-01 ~ 2026-02-01',
      },
    },
  };
}
