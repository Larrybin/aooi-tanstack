import assert from 'node:assert/strict';
import test from 'node:test';

import { localizeNavigationHref } from './navigation';

test('localizeNavigationHref preserves the current non-default route locale', () => {
  assert.equal(
    localizeNavigationHref('/chat/history', '/zh/chat/chat_1'),
    '/zh/chat/history'
  );
  assert.equal(
    localizeNavigationHref(
      '/chat/chat_2?tab=messages#top',
      '/zh-TW/chat/chat_1'
    ),
    '/zh-TW/chat/chat_2?tab=messages#top'
  );
});

test('localizeNavigationHref leaves default-locale and already localized links unchanged', () => {
  assert.equal(
    localizeNavigationHref('/chat/history', '/chat/chat_1'),
    '/chat/history'
  );
  assert.equal(
    localizeNavigationHref('/ja/chat/history', '/zh/chat/chat_1'),
    '/ja/chat/history'
  );
});

test('localizeNavigationHref does not localize non-page hrefs', () => {
  const currentPathname = '/zh/chat/chat_1';

  for (const href of [
    'https://example.com/chat',
    '//example.com/chat',
    'mailto:ops@example.com',
    '#messages',
    '/api/chat/list',
    '/_build/route.js',
    '/ads.txt',
    '/images/logo.png',
  ]) {
    assert.equal(localizeNavigationHref(href, currentPathname), href);
  }
});
