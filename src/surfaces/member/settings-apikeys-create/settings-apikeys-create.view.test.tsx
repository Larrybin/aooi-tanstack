import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import type { SettingsApiKeysCreateRouteData } from './settings-apikeys-create.types';
import { SettingsApiKeysCreateRouteView } from './settings-apikeys-create.view';

test('SettingsApiKeysCreateRouteView renders create form', () => {
  const html = renderToStaticMarkup(
    <SettingsApiKeysCreateRouteView data={createSettingsApiKeysCreateData()} />
  );

  assert.match(html, /Create API Key/);
  assert.match(html, /name="title"/);
  assert.match(html, /required=""/);
  assert.match(html, /href="\/settings\/apikeys"/);
});

function createSettingsApiKeysCreateData(): SettingsApiKeysCreateRouteData {
  return {
    locale: 'en',
    canonicalPath: '/settings/apikeys/create',
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
        items: [{ title: 'Settings', url: '/settings/apikeys/create' }],
      },
    },
    viewer: {
      signedIn: true,
    },
    page: {
      noAuthMessage: 'no auth',
      title: 'Create API Key',
      fields: {
        title: 'Title',
      },
      submitButtonTitle: 'Create',
      backHref: '/settings/apikeys',
      labels: {
        apiKeys: 'API Keys',
      },
    },
  };
}
