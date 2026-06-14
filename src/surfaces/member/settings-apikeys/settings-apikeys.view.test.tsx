import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import type { SettingsApiKeysRouteData } from './settings-apikeys.types';
import { SettingsApiKeysRouteView } from './settings-apikeys.view';

test('SettingsApiKeysRouteView renders API key list actions', () => {
  const html = renderToStaticMarkup(
    <SettingsApiKeysRouteView data={createSettingsApiKeysData()} />
  );

  assert.match(html, /API Keys/);
  assert.match(html, /sk-test-1/);
  assert.match(html, /href="\/settings\/apikeys\/key-1\/edit"/);
  assert.match(html, /href="\/settings\/apikeys\/key-1\/delete"/);
  assert.match(html, /href="\/settings\/apikeys\/create"/);
  assert.match(html, /href="\/settings\/apikeys\?page=3&amp;pageSize=10"/);
});

function createSettingsApiKeysData(): SettingsApiKeysRouteData {
  return {
    locale: 'en',
    canonicalPath: '/settings/apikeys',
    head: {},
    shell: {
      title: 'Settings',
      nav: {
        items: [
          { title: 'Profile', url: '/settings/profile' },
          { title: 'API Keys', url: '/settings/apikeys', active: true },
        ],
      },
      topNav: {
        items: [{ title: 'Settings', url: '/settings/apikeys' }],
      },
    },
    viewer: {
      signedIn: true,
    },
    page: {
      noAuthMessage: 'no auth',
      errorMessage: null,
      createHref: '/settings/apikeys/create',
      query: {
        page: 2,
        pageSize: 10,
      },
      pagination: {
        total: 30,
        page: 2,
        pageSize: 10,
        previousHref: '/settings/apikeys?pageSize=10',
        nextHref: '/settings/apikeys?page=3&pageSize=10',
      },
      labels: {
        listTitle: 'API Keys',
        title: 'Title',
        key: 'Key',
        createdAt: 'Created At',
        action: 'Action',
        create: 'Create API Key',
        edit: 'Edit',
        delete: 'Delete',
        copyAction: 'Copy',
        copySuccess: 'Copied',
        previousPage: 'Previous',
        nextPage: 'Next',
        empty: 'No API Keys',
      },
      records: [
        {
          id: 'key-1',
          title: 'Default',
          key: 'sk-test-1',
          createdAt: '2026-01-01',
          editHref: '/settings/apikeys/key-1/edit',
          deleteHref: '/settings/apikeys/key-1/delete',
        },
      ],
    },
  };
}
