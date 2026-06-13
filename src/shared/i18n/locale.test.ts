import assert from 'node:assert/strict';
import test from 'node:test';

import { defaultLocale, locales } from '@/config/locale';

import { getLocaleFromPathname, localePath } from './locale';

test('getLocaleFromPathname resolves supported locale prefixes', () => {
  const locale = locales.find((candidate) => candidate !== defaultLocale);
  if (!locale) {
    return;
  }

  assert.equal(getLocaleFromPathname(localePath('/pricing', locale)), locale);
});

test('getLocaleFromPathname returns null for default and unknown paths', () => {
  assert.equal(getLocaleFromPathname('/'), null);
  assert.equal(getLocaleFromPathname('/pricing'), null);
  assert.equal(getLocaleFromPathname('/not-a-locale/pricing'), null);
});

test('getLocaleFromPathname handles query and hash suffixes', () => {
  const locale = locales.find((candidate) => candidate !== defaultLocale);
  if (!locale) {
    return;
  }

  assert.equal(
    getLocaleFromPathname(`/${locale}/blog?category=all#top`),
    locale
  );
});
