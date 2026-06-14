import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import type { SettingsApiKeysIdRouteData } from './settings-apikeys-id.types';
import { SettingsApiKeysIdRouteView } from './settings-apikeys-id.view';

test('SettingsApiKeysIdRouteView renders edit form', () => {
  const html = renderToStaticMarkup(
    <SettingsApiKeysIdRouteView data={createSettingsApiKeysIdData('edit')} />
  );

  assert.match(html, /Edit API Key/);
  assert.match(html, /name="title"/);
  assert.match(html, /value="Default"/);
  assert.doesNotMatch(html, /name="key"/);
});

test('SettingsApiKeysIdRouteView renders delete confirmation', () => {
  const html = renderToStaticMarkup(
    <SettingsApiKeysIdRouteView data={createSettingsApiKeysIdData('delete')} />
  );

  assert.match(html, /Delete API Key/);
  assert.match(html, /name="title"/);
  assert.match(html, /name="key"/);
  assert.match(html, /value="sk-test-1"/);
  assert.match(html, /disabled=""/);
});

function createSettingsApiKeysIdData(
  mode: 'edit' | 'delete'
): SettingsApiKeysIdRouteData {
  return {
    locale: 'en',
    canonicalPath: `/settings/apikeys/key-1/${mode}`,
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
        items: [{ title: 'Settings', url: `/settings/apikeys/key-1/${mode}` }],
      },
    },
    viewer: {
      signedIn: true,
    },
    page: {
      mode,
      message: null,
      title: mode === 'edit' ? 'Edit API Key' : 'Delete API Key',
      noAuthMessage: 'no auth',
      noPermissionMessage: 'no permission',
      backHref: '/settings/apikeys',
      labels: {
        apiKeys: 'API Keys',
        title: 'Title',
        key: 'Key',
        submit: mode === 'edit' ? 'Update' : 'Confirm Delete',
      },
      apikey: {
        id: 'key-1',
        title: 'Default',
        ...(mode === 'delete' ? { key: 'sk-test-1' } : {}),
      },
    },
  };
}
