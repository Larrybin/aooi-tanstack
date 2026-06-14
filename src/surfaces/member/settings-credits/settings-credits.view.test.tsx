import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import type { SettingsCreditsRouteData } from './settings-credits.types';
import { SettingsCreditsRouteView } from './settings-credits.view';

test('SettingsCreditsRouteView renders pagination on empty out-of-range pages', () => {
  const html = renderToStaticMarkup(
    <SettingsCreditsRouteView data={createSettingsCreditsData()} />
  );

  assert.match(html, /No credit records/);
  assert.match(html, /Previous/);
  assert.match(html, /href="\/settings\/credits\?page=3&amp;pageSize=10"/);
});

function createSettingsCreditsData(): SettingsCreditsRouteData {
  return {
    locale: 'en',
    canonicalPath: '/settings/credits',
    head: {},
    shell: {
      title: 'Settings',
      nav: {
        items: [
          { title: 'Profile', url: '/settings/profile' },
          { title: 'Security', url: '/settings/security' },
          { title: 'Credits', url: '/settings/credits', active: true },
        ],
      },
      topNav: {
        items: [{ title: 'Home', url: '/' }],
      },
    },
    viewer: {
      signedIn: true,
    },
    page: {
      noAuthMessage: 'Please sign in to continue',
      errorMessage: null,
      remainingCredits: 3,
      purchaseUrl: '/pricing',
      query: {
        page: 999,
        pageSize: 10,
        type: 'all',
      },
      pagination: {
        total: 30,
        page: 999,
        pageSize: 10,
        previousHref: '/settings/credits?page=3&pageSize=10',
        nextHref: null,
      },
      labels: {
        balanceTitle: 'Credits Balance',
        purchaseButton: 'Purchase Credits',
        listTitle: 'Credits Records',
        transactionNo: 'Transaction No',
        description: 'Description',
        type: 'Type',
        scene: 'Scene',
        credits: 'Credits',
        expiresAt: 'Expires At',
        createdAt: 'Created At',
        copyAction: 'Copy',
        copySuccess: 'Copied',
        previousPage: 'Previous',
        nextPage: 'Next',
        empty: 'No credit records',
      },
      tabs: [
        { title: 'All', type: 'all', href: '/settings/credits', active: true },
        {
          title: 'Grant',
          type: 'grant',
          href: '/settings/credits?type=grant',
          active: false,
        },
        {
          title: 'Consume',
          type: 'consume',
          href: '/settings/credits?type=consume',
          active: false,
        },
      ],
      records: [],
    },
  };
}
