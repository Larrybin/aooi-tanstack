import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import type { SettingsPaymentsRouteData } from './settings-payments.types';
import { SettingsPaymentsRouteView } from './settings-payments.view';

test('SettingsPaymentsRouteView renders read-only payments with invoice links only', () => {
  const html = renderToStaticMarkup(
    <SettingsPaymentsRouteView data={createSettingsPaymentsData()} />
  );

  assert.match(html, /order-1/);
  assert.match(html, /href="https:\/\/billing\.example\.test\/invoice-1"/);
  assert.match(html, /target="_blank"/);
  assert.match(html, /href="\/settings\/invoices\/retrieve\?order_no=order-2"/);
  assert.doesNotMatch(html, /Payment callback/);
  assert.doesNotMatch(html, /api\/payment\/callback/);
  assert.doesNotMatch(html, /settings\/billing\/cancel/);
  assert.doesNotMatch(html, /settings\/billing\/retrieve/);
});

test('SettingsPaymentsRouteView renders payment callback confirmation controls', () => {
  const html = renderToStaticMarkup(
    <SettingsPaymentsRouteView
      data={createSettingsPaymentsData({
        paymentCallback: {
          orderNo: 'order-callback',
          cleanUrl: '/settings/payments',
        },
      })}
    />
  );

  assert.match(html, /Payment callback/);
  assert.match(html, /order-callback/);
  assert.match(html, /href="\/settings\/payments"/);
});

function createSettingsPaymentsData(
  pageOverrides: Partial<SettingsPaymentsRouteData['page']> = {}
): SettingsPaymentsRouteData {
  return {
    locale: 'en',
    canonicalPath: '/settings/payments',
    head: {},
    shell: {
      title: 'Settings',
      nav: {
        items: [
          { title: 'Profile', url: '/settings/profile' },
          { title: 'Security', url: '/settings/security' },
          { title: 'Credits', url: '/settings/credits' },
          { title: 'Billing', url: '/settings/billing' },
          { title: 'Payments', url: '/settings/payments', active: true },
        ],
      },
      topNav: {
        items: [{ title: 'Settings', url: '/settings/payments' }],
      },
    },
    viewer: {
      signedIn: true,
    },
    page: {
      noAuthMessage: 'no auth',
      errorMessage: null,
      paymentCallback: null,
      query: {
        page: 1,
        pageSize: 20,
        type: 'all',
        orderNo: 'order-callback',
      },
      pagination: {
        total: 2,
        page: 1,
        pageSize: 20,
        previousHref: null,
        nextHref: null,
      },
      labels: {
        listTitle: 'Payments',
        listDescription: 'View your payments',
        orderNo: 'Order No',
        productName: 'Product Name',
        status: 'Status',
        type: 'Type',
        price: 'Price',
        paidAmount: 'Paid Amount',
        discountAmount: 'Discount Amount',
        createdAt: 'Created At',
        invoice: 'View Invoice',
        copyAction: 'Copy',
        copySuccess: 'Copied',
        previousPage: 'Previous',
        nextPage: 'Next',
        empty: 'No payment records',
        callbackTitle: 'Payment callback',
        callbackOrderNo: 'Order No',
        callbackClear: 'Clear status',
        callbackFailed: 'Failed to confirm payment',
      },
      tabs: [
        {
          title: 'All',
          type: 'all',
          href: '/settings/payments',
          active: true,
        },
      ],
      records: [
        {
          id: 'payment-1',
          orderNo: 'order-1',
          productName: 'Pro',
          status: 'paid',
          type: 'subscription',
          price: '$99',
          paidAmount: '$79',
          discountAmount: '$20',
          createdAt: '2026-01-01',
          invoiceHref: 'https://billing.example.test/invoice-1',
          invoiceExternal: true,
        },
        {
          id: 'payment-2',
          orderNo: 'order-2',
          productName: 'Pro',
          status: 'paid',
          type: 'renew',
          price: '$99',
          paidAmount: '$99',
          discountAmount: '$0',
          createdAt: '2026-02-01',
          invoiceHref: '/settings/invoices/retrieve?order_no=order-2',
          invoiceExternal: false,
        },
      ],
      ...pageOverrides,
    },
  };
}
