import assert from 'node:assert/strict';
import test from 'node:test';

import { getTranslations, useTranslations } from './native';

test('native i18n resolves default-locale common messages', () => {
  const t = useTranslations('common.sign');

  assert.equal(t('sign_out_title'), 'Sign Out');
});

test('native i18n interpolates common message values', () => {
  const t = useTranslations('common.uploader.image');

  assert.equal(
    t('file_too_large', { name: 'avatar.png', maxSize: 5 }),
    '"avatar.png" exceeds the 5MB limit'
  );
});

test('native i18n resolves admin settings namespaces', async () => {
  const t = await getTranslations('admin.settings');

  assert.equal(t('edit.tabs.general'), 'General');
});

test('native i18n resolves server translations for an explicit locale', async () => {
  const t = await getTranslations('admin.settings', 'zh');

  assert.equal(t('edit.tabs.auth'), '认证');
});
