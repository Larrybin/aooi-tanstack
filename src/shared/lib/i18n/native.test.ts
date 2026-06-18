import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  getTranslations,
  NativeLocaleProvider,
  useTranslations,
} from './native';

test('native i18n resolves default-locale common messages', () => {
  const html = renderToStaticMarkup(createElement(SignOutTitle));

  assert.equal(html, '<span>Sign Out</span>');
});

test('native i18n interpolates common message values', () => {
  const html = renderToStaticMarkup(createElement(FileTooLargeMessage));

  assert.equal(
    html,
    '<span>&quot;avatar.png&quot; exceeds the 5MB limit</span>'
  );
});

test('native i18n uses the provided locale during server render', () => {
  const html = renderToStaticMarkup(
    createElement(
      NativeLocaleProvider,
      { locale: 'zh' },
      createElement(SignOutTitle)
    )
  );

  assert.equal(html, '<span>登出</span>');
});

test('native i18n resolves admin settings namespaces', async () => {
  const t = await getTranslations('admin.settings');

  assert.equal(t('edit.tabs.general'), 'General');
});

test('native i18n resolves server translations for an explicit locale', async () => {
  const t = await getTranslations('admin.settings', 'zh');

  assert.equal(t('edit.tabs.auth'), '认证');
});

function SignOutTitle() {
  const t = useTranslations('common.sign');
  return createElement('span', null, t('sign_out_title'));
}

function FileTooLargeMessage() {
  const t = useTranslations('common.uploader.image');
  return createElement(
    'span',
    null,
    t('file_too_large', { name: 'avatar.png', maxSize: 5 })
  );
}
